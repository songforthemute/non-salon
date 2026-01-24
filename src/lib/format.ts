import { SITE } from "@/config";

export function formatDate(dateStr: string, options?: Intl.DateTimeFormatOptions): string {
	const defaultOptions: Intl.DateTimeFormatOptions = {
		year: "numeric",
		month: "long",
		day: "numeric",
	};
	return new Date(dateStr).toLocaleDateString(SITE.language, options ?? defaultOptions);
}

export function formatDateShort(dateStr: string): string {
	return formatDate(dateStr, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}
