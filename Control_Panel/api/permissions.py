from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsSuperUser(BasePermission):
    """
    Allows access only to authenticated superusers.
    - Unauthenticated requests: 401 Unauthorized
    - Non-superuser requests (including ordinary staff users): 403 Forbidden
    - Superusers: Permitted
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_superuser)


class IsSuperUserOrReadOnly(BasePermission):
    """
    Public read-only (GET, HEAD, OPTIONS).
    Write operations (POST, PUT, PATCH, DELETE) require superuser privileges.
    """
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_authenticated and request.user.is_superuser)
