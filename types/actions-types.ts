export type ActionState<T> =
  | { status: "success"; data: T }
  | { status: "error"; message: string }
