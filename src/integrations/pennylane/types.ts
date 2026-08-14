export type PennylaneRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: Record<string, unknown>
  query?: Record<string, string | number | boolean | undefined>
}
