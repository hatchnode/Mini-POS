/** Short, collision-resistant id for local records. */
export const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-5);
