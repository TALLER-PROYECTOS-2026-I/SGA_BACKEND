/**
 * Roles del sistema
 * Estos roles deben coincidir con los IDs en la tabla categoria_usuario
 */
export const USER_ROLES = {
  DOCENTE: 1,
  DIRECTOR_ESCUELA: 2,
  INDETERMINADO: 2, // Alias temporal: antes el Director estaba registrado con este nombre técnico
  COORDINADOR: 3,
  ADMIN: 4,
  COMITE_CURRICULAR_OPERATIVO: 5,
} as const;

/**
 * Tipo para los nombres de roles
 */
export type RoleName = keyof typeof USER_ROLES;

/**
 * Tipo para los IDs de roles
 */
export type RoleId = (typeof USER_ROLES)[RoleName];

/**
 * Mapeo inverso: de ID a nombre de rol
 */
export const ROLE_ID_TO_NAME: Record<number, RoleName> = {
  [USER_ROLES.DOCENTE]: "DOCENTE",
  [USER_ROLES.DIRECTOR_ESCUELA]: "DIRECTOR_ESCUELA",
  [USER_ROLES.COORDINADOR]: "COORDINADOR",
  [USER_ROLES.ADMIN]: "ADMIN",
  [USER_ROLES.COMITE_CURRICULAR_OPERATIVO]: "COMITE_CURRICULAR_OPERATIVO",
};

/**
 * Convierte nombres de roles a sus IDs correspondientes
 * @param roleNames Array de nombres de roles
 * @returns Array de IDs de roles
 */
export function roleNamesToIds(roleNames: RoleName[]): number[] {
  return roleNames.map((name) => USER_ROLES[name]);
}

/**
 * Verifica si un ID de rol es válido
 * @param roleId ID del rol a verificar
 * @returns true si el rol existe
 */
export function isValidRoleId(roleId: number): boolean {
  return Object.values(USER_ROLES).includes(roleId as RoleId);
}

/**
 * Obtiene el nombre de un rol por su ID
 * @param roleId ID del rol
 * @returns Nombre del rol o undefined si no existe
 */
export function getRoleName(roleId: number): RoleName | undefined {
  return ROLE_ID_TO_NAME[roleId];
}
