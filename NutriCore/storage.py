import os
import mimetypes
import requests
from django.core.files.storage import Storage
from django.core.files.base import ContentFile
from django.utils.deconstruct import deconstructible
from django.conf import settings


@deconstructible
class SupabaseStorage(Storage):
    """
    Custom Django Storage backend that connects to Supabase Storage.
    - Saves new uploads to Supabase Storage bucket via REST API using the server-side service-role key.
    - Resolves public URLs via the Supabase CDN public endpoint.
    - Preserves compatibility with Django's ImageField and FileField.
    """
    def __init__(self, bucket_name=None, supabase_url=None, service_key=None):
        self.bucket_name = bucket_name or getattr(settings, 'SUPABASE_STORAGE_BUCKET', 'nutricore-media')
        self.supabase_url = (supabase_url or getattr(settings, 'SUPABASE_URL', '')).rstrip('/')
        self.service_key = service_key or getattr(settings, 'SUPABASE_SERVICE_ROLE_KEY', '')

    @property
    def headers(self):
        return {
            "Authorization": f"Bearer {self.service_key}",
            "apiKey": self.service_key,
        }

    def _clean_name(self, name):
        return str(name).replace('\\', '/').lstrip('/')

    def _save(self, name, content):
        cleaned_name = self._clean_name(name)
        mime_type, _ = mimetypes.guess_type(cleaned_name)
        if not mime_type:
            mime_type = 'application/octet-stream'

        if hasattr(content, 'read'):
            file_data = content.read()
        else:
            file_data = content

        upload_url = f"{self.supabase_url}/storage/v1/object/{self.bucket_name}/{cleaned_name}"
        req_headers = {
            **self.headers,
            "Content-Type": mime_type,
            "x-upsert": "true"
        }

        response = requests.post(upload_url, headers=req_headers, data=file_data, timeout=30)
        if response.status_code not in [200, 201]:
            raise IOError(f"Supabase Storage upload failed with status {response.status_code}: {response.text}")

        return cleaned_name

    def _open(self, name, mode='rb'):
        cleaned_name = self._clean_name(name)
        file_url = self.url(cleaned_name)
        response = requests.get(file_url, timeout=30)
        if response.status_code == 200:
            return ContentFile(response.content)
        raise FileNotFoundError(f"File {cleaned_name} not found in Supabase Storage.")

    def exists(self, name):
        cleaned_name = self._clean_name(name)
        file_url = self.url(cleaned_name)
        try:
            response = requests.head(file_url, timeout=10)
            return response.status_code == 200
        except Exception:
            return False

    def url(self, name):
        if not name:
            return ""
        str_name = str(name).strip()
        if str_name.startswith(('http://', 'https://')):
            return str_name
        cleaned_name = self._clean_name(str_name)
        return f"{self.supabase_url}/storage/v1/object/public/{self.bucket_name}/{cleaned_name}"

    def size(self, name):
        cleaned_name = self._clean_name(name)
        file_url = self.url(cleaned_name)
        try:
            response = requests.head(file_url, timeout=10)
            if response.status_code == 200:
                return int(response.headers.get('Content-Length', 0))
        except Exception:
            pass
        return 0

    def delete(self, name):
        cleaned_name = self._clean_name(name)
        delete_url = f"{self.supabase_url}/storage/v1/object/{self.bucket_name}/{cleaned_name}"
        try:
            requests.delete(delete_url, headers=self.headers, timeout=10)
        except Exception:
            pass
