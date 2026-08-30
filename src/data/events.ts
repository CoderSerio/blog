export type EventCategory = "AI" | "DevTools" | "Frontend" | "Cloud" | "Mobile";

export type EventStatus = "confirmed" | "watch";

export interface CalendarEvent {
	id: string;
	title: string;
	start: string;
	end?: string;
	category: EventCategory;
	organizer: string;
	location: string;
	url: string;
	status: EventStatus;
	tags: string[];
	notes?: string;
}

export const eventCategories: EventCategory[] = [
	"AI",
	"DevTools",
	"Frontend",
	"Cloud",
	"Mobile",
];

export const events: CalendarEvent[] = [
	{
		id: "ai-engineer-worlds-fair-2026",
		title: "AI Engineer World's Fair",
		start: "2026-06-29",
		end: "2026-07-02",
		category: "AI",
		organizer: "AI Engineer",
		location: "San Francisco / Online",
		url: "https://www.ai.engineer/schedule",
		status: "confirmed",
		tags: ["agent", "llm", "app"],
		notes: "Good benchmark for applied AI engineering trends.",
	},
	{
		id: "vercel-ship-nyc-2026",
		title: "Vercel Ship NYC",
		start: "2026-06-30",
		category: "Frontend",
		organizer: "Vercel",
		location: "New York",
		url: "https://vercel.com/ship",
		status: "confirmed",
		tags: ["web", "platform", "ai"],
	},
	{
		id: "kubecon-japan-2026",
		title: "KubeCon + CloudNativeCon Japan",
		start: "2026-07-28",
		end: "2026-07-30",
		category: "Cloud",
		organizer: "CNCF",
		location: "Tokyo",
		url: "https://www.cncf.io/kubecon-cloudnativecon-events/",
		status: "confirmed",
		tags: ["kubernetes", "cloud-native"],
	},
	{
		id: "meta-connect-2026",
		title: "Meta Connect",
		start: "2026-09-23",
		end: "2026-09-24",
		category: "AI",
		organizer: "Meta",
		location: "Menlo Park / Online",
		url: "https://about.fb.com/news/",
		status: "watch",
		tags: ["meta-ai", "xr", "wearables"],
		notes: "Track keynote confirmation and replay links.",
	},
	{
		id: "openai-devday-2026",
		title: "OpenAI DevDay",
		start: "2026-09-29",
		category: "AI",
		organizer: "OpenAI",
		location: "San Francisco",
		url: "https://openai.com/index/devday-2026/",
		status: "confirmed",
		tags: ["api", "models", "agents"],
	},
	{
		id: "github-universe-2026",
		title: "GitHub Universe",
		start: "2026-10-28",
		end: "2026-10-29",
		category: "DevTools",
		organizer: "GitHub",
		location: "San Francisco / Online",
		url: "https://githubuniverse.com/",
		status: "confirmed",
		tags: ["copilot", "platform"],
	},
	{
		id: "microsoft-ignite-2026",
		title: "Microsoft Ignite",
		start: "2026-11-17",
		end: "2026-11-20",
		category: "Cloud",
		organizer: "Microsoft",
		location: "San Francisco",
		url: "https://ignite.microsoft.com/en-US/home",
		status: "confirmed",
		tags: ["azure", "copilot", "enterprise"],
	},
	{
		id: "aws-reinvent-2026",
		title: "AWS re:Invent",
		start: "2026-11-30",
		end: "2026-12-04",
		category: "Cloud",
		organizer: "AWS",
		location: "Las Vegas",
		url: "https://aws.amazon.com/events/reinvent/",
		status: "confirmed",
		tags: ["aws", "infra", "ai"],
	},
];
