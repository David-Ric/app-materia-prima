/** Grupos de usuário com acesso ao módulo Matéria Prima (mesma regra pedida para o banner desktop pós-validação). */
export const GRUPOS_AUTORIZADOS_MATERIA_PRIMA = [1, 4, 6, 8] as const

export function grupoPodeAcessarMateriaPrima(grupoId: number): boolean {
  return (GRUPOS_AUTORIZADOS_MATERIA_PRIMA as readonly number[]).includes(grupoId)
}
