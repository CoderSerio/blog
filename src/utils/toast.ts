import { writable } from "svelte/store";

export type Toast = {
	id: number;
	message: string;
	type: "success" | "error";
};

const timers = new Map<number, ReturnType<typeof setTimeout>>();
let nextToastId = 0;

export const toasts = writable<Toast[]>([]);

export function dismissToast(id: number) {
	const timer = timers.get(id);

	if (timer) {
		clearTimeout(timer);
		timers.delete(id);
	}

	toasts.update((items) => items.filter((toast) => toast.id !== id));
}

export function showToast(message: string, type: Toast["type"]) {
	const id = ++nextToastId;

	toasts.update((items) => [{ id, message, type }, ...items]);
	timers.set(
		id,
		setTimeout(() => dismissToast(id), 5000),
	);
}
