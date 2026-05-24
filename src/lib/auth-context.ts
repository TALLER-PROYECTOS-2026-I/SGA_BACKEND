import type { HttpRequest } from "@azure/functions";
import { USER_ROLES } from "../constants/roles";

export type AuthUser = {
  id?: number;
  docenteId?: number;
  userId?: number;
  email?: string;
  correo?: string;

  role?: string | number;
  rol?: string | number;
  roleId?: string | number;
  rolId?: string | number;
  roles?: Array<string | number>;
  name?: string | null;

  categoriaUsuarioId?: string | number;
  categoria_usuario_id?: string | number;
  categoriaId?: string | number;
  categoria_id?: string | number;
  tipoUsuarioId?: string | number;
  tipo_usuario_id?: string | number;
  perfilId?: string | number;
  perfil_id?: string | number;

  roleName?: string;
  rolNombre?: string;
  nombreRol?: string;
  categoriaNombre?: string;
  perfil?: string;
  perfilNombre?: string;
  currentRole?: string | number;
  selectedRole?: string | number;
  selectedRoleId?: string | number;
};

const AUTH_USER_KEY = "__sgaAuthUser";

const ROLE_NAME_TO_ID: Record<string, number> = {
  DOCENTE: USER_ROLES.DOCENTE,
  PROFESOR: USER_ROLES.DOCENTE,
  TEACHER: USER_ROLES.DOCENTE,

  INDETERMINADO: USER_ROLES.INDETERMINADO,

  COORDINADOR: USER_ROLES.COORDINADOR,
  COORDINADORA: USER_ROLES.COORDINADOR,
  COORDINADOR_ACADEMICO: USER_ROLES.COORDINADOR,
  COORDINADORA_ACADEMICA: USER_ROLES.COORDINADOR,
  COORDINADOR_GESTION_ACADEMICA: USER_ROLES.COORDINADOR,
  COORDINADORA_GESTION_ACADEMICA: USER_ROLES.COORDINADOR,
  GESTION_ACADEMICA: USER_ROLES.COORDINADOR,
  GESTION_ACADEMICO: USER_ROLES.COORDINADOR,

  DIRECTOR: USER_ROLES.COORDINADOR,
  DIRECTORA: USER_ROLES.COORDINADOR,
  DIRECTOR_ACADEMICO: USER_ROLES.COORDINADOR,
  DIRECTORA_ACADEMICA: USER_ROLES.COORDINADOR,

  ADMIN: USER_ROLES.ADMIN,
  ADMINISTRADOR: USER_ROLES.ADMIN,
  ADMINISTRADORA: USER_ROLES.ADMIN,
};

const PRIVILEGED_CREATE_ROLE_IDS = new Set<number>([
  USER_ROLES.INDETERMINADO,
  USER_ROLES.COORDINADOR,
  USER_ROLES.ADMIN,
]);

function toPositiveInt(value: unknown): number | undefined {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed;
}

function normalizeRoleName(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function resolveAuthUserId(user: AuthUser): number | undefined {
  const candidates = [user.id, user.docenteId, user.userId];

  for (const candidate of candidates) {
    const parsed = toPositiveInt(candidate);
    if (parsed) return parsed;
  }

  return undefined;
}

export function resolveAuthUserRole(user: AuthUser): number | undefined {
  const numericCandidates = [
    user.selectedRoleId,
    user.selectedRole,
    user.currentRole,

    user.role,
    user.rol,
    user.roleId,
    user.rolId,

    user.categoriaUsuarioId,
    user.categoria_usuario_id,
    user.categoriaId,
    user.categoria_id,
    user.tipoUsuarioId,
    user.tipo_usuario_id,
    user.perfilId,
    user.perfil_id,

    ...(Array.isArray(user.roles) ? user.roles : []),
  ];

  for (const candidate of numericCandidates) {
    const parsed = toPositiveInt(candidate);
    if (parsed) return parsed;
  }

  const nameCandidates = [
    user.role,
    user.rol,
    user.roleName,
    user.rolNombre,
    user.nombreRol,
    user.categoriaNombre,
    user.perfil,
    user.perfilNombre,
    user.selectedRole,
    user.currentRole,
    ...(Array.isArray(user.roles) ? user.roles : []),
  ];

  for (const candidate of nameCandidates) {
    const roleName = normalizeRoleName(candidate);
    if (!roleName) continue;

    const mapped = ROLE_NAME_TO_ID[roleName];
    if (mapped) return mapped;

    if (roleName.includes("ADMIN")) {
      return USER_ROLES.ADMIN;
    }

    if (
      roleName.includes("COORDINADOR") ||
      roleName.includes("COORDINADORA") ||
      roleName.includes("DIRECTOR") ||
      roleName.includes("DIRECTORA") ||
      roleName.includes("GESTION_ACADEMICA") ||
      roleName.includes("GESTION_ACADEMICO")
    ) {
      return USER_ROLES.COORDINADOR;
    }

    if (
      roleName.includes("DOCENTE") ||
      roleName.includes("PROFESOR") ||
      roleName.includes("TEACHER")
    ) {
      return USER_ROLES.DOCENTE;
    }
  }

  return undefined;
}

export function canAuthUserCreateSyllabus(user: AuthUser): boolean {
  const roleId = resolveAuthUserRole(user);

  if (roleId && PRIVILEGED_CREATE_ROLE_IDS.has(roleId)) {
    return true;
  }

  const rawRoleValues = [
    user.role,
    user.rol,
    user.roleName,
    user.rolNombre,
    user.nombreRol,
    user.categoriaNombre,
    user.perfil,
    user.perfilNombre,
    user.selectedRole,
    user.currentRole,
    ...(Array.isArray(user.roles) ? user.roles : []),
  ];

  return rawRoleValues.some((value) => {
    const roleName = normalizeRoleName(value);

    return (
      roleName.includes("COORDINADOR") ||
      roleName.includes("COORDINADORA") ||
      roleName.includes("DIRECTOR") ||
      roleName.includes("DIRECTORA") ||
      roleName.includes("ADMIN") ||
      roleName.includes("GESTION_ACADEMICA") ||
      roleName.includes("GESTION_ACADEMICO") ||
      roleName === "INDETERMINADO"
    );
  });
}

export function setAuthUser(req: HttpRequest, user: AuthUser) {
  Object.defineProperty(req, AUTH_USER_KEY, {
    value: user,
    enumerable: false,
    configurable: true,
    writable: true,
  });
}

export function getAuthUser(req: HttpRequest): AuthUser | null {
  return ((req as any)[AUTH_USER_KEY] as AuthUser | undefined) ?? null;
}