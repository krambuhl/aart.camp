export type OnlyOptional<T, K extends keyof T> = Partial<Exclude<T, K>>;
export type OnlyRequired<T, K extends keyof T> = Pick<T, K>;

export type PartialExcept<T, K extends keyof T> = OnlyOptional<T, K> & OnlyRequired<T, K>;

export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
export type PartialFor<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
