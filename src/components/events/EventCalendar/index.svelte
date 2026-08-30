<script lang="ts">
import type {
	DateClickArg,
	EventClickArg,
	EventInput,
} from "@fullcalendar/core";
import { Calendar } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import listPlugin from "@fullcalendar/list";
import { onMount } from "svelte";
import type { CalendarEvent, EventCategory } from "@/data/events";

export let events: CalendarEvent[] = [];
export let categories: EventCategory[] = [];

type EventView = "dayGridMonth" | "listMonth";

const today = new Date();

let calendarElement: HTMLDivElement;
let calendar: Calendar | null = null;
let currentTitle = "";
let selectedCategory: EventCategory | "All" = "All";
let selectedDate = toDateKey(today);
let currentView: EventView = "dayGridMonth";

function toDateKey(date: Date) {
	const year = date.getFullYear();
	const month = `${date.getMonth() + 1}`.padStart(2, "0");
	const day = `${date.getDate()}`.padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function parseDate(input: string) {
	return new Date(`${input}T00:00:00`);
}

function formatDisplayDate(input: string) {
	return new Intl.DateTimeFormat("en", {
		month: "short",
		day: "numeric",
	}).format(parseDate(input));
}

function eventOccursOnDate(event: CalendarEvent, dateKey: string) {
	const endDate = event.end ?? event.start;
	return dateKey >= event.start && dateKey <= endDate;
}

function toCalendarEvents(sourceEvents: CalendarEvent[]): EventInput[] {
	return sourceEvents.map((event) => ({
		id: event.id,
		title: event.title,
		start: event.start,
		end: event.end
			? toDateKey(new Date(parseDate(event.end).getTime() + 86400000))
			: undefined,
		allDay: true,
		extendedProps: {
			category: event.category,
			organizer: event.organizer,
			location: event.location,
			status: event.status,
			tags: event.tags,
			url: event.url,
			notes: event.notes,
		},
	}));
}

function updateCalendarFromApi() {
	if (!calendar) {
		return;
	}

	currentTitle = calendar.view.title;
	currentView = calendar.view.type as EventView;
}

function handleDateClick(info: DateClickArg) {
	selectedDate = info.dateStr;
}

function handleEventClick(info: EventClickArg) {
	info.jsEvent.preventDefault();
	selectedDate = info.event.startStr.slice(0, 10);
	window.open(info.event.extendedProps.url as string, "_blank", "noopener");
}

function renderCalendar() {
	if (!calendarElement) {
		return;
	}

	calendar?.destroy();
	calendar = new Calendar(calendarElement, {
		plugins: [dayGridPlugin, listPlugin],
		initialView: currentView,
		initialDate: selectedDate,
		headerToolbar: false,
		height: "auto",
		dayMaxEvents: 2,
		fixedWeekCount: true,
		nowIndicator: false,
		events: toCalendarEvents(filteredEvents),
		dateClick: handleDateClick,
		eventClick: handleEventClick,
		datesSet: updateCalendarFromApi,
	});
	calendar.render();
	updateCalendarFromApi();
}

function shiftMonth(step: number) {
	calendar?.incrementDate({ months: step });
	updateCalendarFromApi();
}

function switchView(nextView: EventView) {
	currentView = nextView;
	calendar?.changeView(nextView);
	updateCalendarFromApi();
}

$: filteredEvents =
	selectedCategory === "All"
		? events
		: events.filter((event) => event.category === selectedCategory);

$: selectedEvents = filteredEvents
	.filter((event) => eventOccursOnDate(event, selectedDate))
	.sort((left, right) => left.start.localeCompare(right.start));

$: if (calendar) {
	calendar.removeAllEvents();
	toCalendarEvents(filteredEvents).forEach((event) => {
		calendar?.addEvent(event);
	});
	updateCalendarFromApi();
}

onMount(() => {
	renderCalendar();

	return () => {
		calendar?.destroy();
	};
});
</script>

<svelte:head>
	<link href="https://cdn.jsdelivr.net/npm/@fullcalendar/core@6.1.21/index.global.min.css" rel="stylesheet" />
	<link href="https://cdn.jsdelivr.net/npm/@fullcalendar/daygrid@6.1.21/index.global.min.css" rel="stylesheet" />
	<link href="https://cdn.jsdelivr.net/npm/@fullcalendar/list@6.1.21/index.global.min.css" rel="stylesheet" />
</svelte:head>

<section class="card-base event-board">
	<div class="toolbar">
		<div class="toolbar__title">
			<p class="toolbar__eyebrow">Launch calendar</p>
			<h1>{currentTitle || "Loading calendar"}</h1>
		</div>

		<div class="toolbar__actions">
			<div class="month-switcher">
				<button type="button" class="btn-plain month-switcher__button" on:click={() => shiftMonth(-1)}>
					Prev
				</button>
				<button type="button" class="btn-plain month-switcher__button" on:click={() => shiftMonth(1)}>
					Next
				</button>
			</div>

			<div class="view-switcher">
				<button
					type="button"
					class:active={currentView === "dayGridMonth"}
					class="filter-chip"
					on:click={() => switchView("dayGridMonth")}
				>
					Month
				</button>
				<button
					type="button"
					class:active={currentView === "listMonth"}
					class="filter-chip"
					on:click={() => switchView("listMonth")}
				>
					List
				</button>
			</div>

			<div class="filters">
				<button
					type="button"
					class:active={selectedCategory === "All"}
					class="filter-chip"
					on:click={() => (selectedCategory = "All")}
				>
					All
				</button>
				{#each categories as category}
					<button
						type="button"
						class:active={selectedCategory === category}
						class="filter-chip"
						on:click={() => (selectedCategory = category)}
					>
						{category}
					</button>
				{/each}
			</div>
		</div>
	</div>

	<div class="calendar-layout">
		<div class="calendar-shell">
			<div bind:this={calendarElement} class="calendar-host"></div>
		</div>

		<aside class="event-panel">
			<div class="event-panel__header">
				<p>Selected day</p>
				<h2>{formatDisplayDate(selectedDate)}</h2>
			</div>

			{#if selectedEvents.length === 0}
				<p class="event-panel__empty">No launches or conferences on this day yet.</p>
			{:else}
				<div class="event-list">
					{#each selectedEvents as event}
						<a class="event-card" href={event.url} target="_blank" rel="noreferrer">
							<div class="event-card__meta">
								<span class="event-card__category event-card__category--{event.category.toLowerCase()}">
									{event.category}
								</span>
								<span class="event-card__status">{event.status}</span>
							</div>
							<h3>{event.title}</h3>
							<p>{event.organizer} · {event.location}</p>
							<p>
								{formatDisplayDate(event.start)}
								{#if event.end}
									 to {formatDisplayDate(event.end)}
								{/if}
							</p>
							{#if event.notes}
								<p>{event.notes}</p>
							{/if}
						</a>
					{/each}
				</div>
			{/if}
		</aside>
	</div>
</section>

<style>
	:global(.fc) {
		--fc-border-color: var(--line-divider);
		--fc-page-bg-color: transparent;
		--fc-neutral-bg-color: transparent;
		--fc-list-event-hover-bg-color: var(--btn-plain-bg-hover);
		--fc-today-bg-color: color-mix(in oklab, var(--primary) 10%, transparent);
		--fc-button-bg-color: transparent;
		--fc-button-border-color: transparent;
		--fc-button-hover-bg-color: transparent;
		--fc-button-active-bg-color: transparent;
		color: inherit;
	}

	:global(.fc .fc-toolbar.fc-header-toolbar) {
		display: none;
	}

	:global(.fc .fc-col-header-cell-cushion),
	:global(.fc .fc-daygrid-day-number),
	:global(.fc .fc-list-day-text),
	:global(.fc .fc-list-day-side-text) {
		color: inherit;
		text-decoration: none;
	}

	:global(.fc .fc-daygrid-day-frame) {
		min-height: 7.8rem;
	}

	:global(.fc .fc-daygrid-day.fc-day-today) {
		background: var(--fc-today-bg-color);
	}

	:global(.fc .fc-h-event) {
		border: 0;
		border-radius: 0.5rem;
		padding: 0.1rem 0.15rem;
		background: color-mix(in oklab, var(--primary) 16%, transparent);
		color: var(--primary);
	}

	:global(.fc .fc-list-event-title a),
	:global(.fc .fc-list-event-time) {
		color: inherit;
	}

	.event-board {
		padding: 1.5rem;
	}

	.toolbar {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: flex-start;
		margin-bottom: 1.5rem;
		flex-wrap: wrap;
	}

	.toolbar__eyebrow {
		margin: 0 0 0.25rem;
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--meta);
	}

	.toolbar__title h1,
	.event-panel__header h2 {
		margin: 0;
		font-size: 1.75rem;
		font-weight: 700;
	}

	.toolbar__actions {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
		align-items: center;
		justify-content: flex-end;
	}

	.month-switcher,
	.filters,
	.view-switcher {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.month-switcher__button,
	.filter-chip {
		border-radius: 0.6rem;
		padding: 0.6rem 0.9rem;
		font-size: 0.9rem;
		font-weight: 600;
	}

	.filter-chip {
		border: 1px solid color-mix(in oklab, var(--primary) 20%, transparent);
		background: transparent;
		color: inherit;
	}

	.filter-chip.active {
		background: color-mix(in oklab, var(--primary) 16%, var(--card-bg));
		border-color: color-mix(in oklab, var(--primary) 55%, transparent);
		color: var(--primary);
	}

	.calendar-layout {
		display: grid;
		grid-template-columns: minmax(0, 1.8fr) minmax(18rem, 0.9fr);
		gap: 1rem;
	}

	.calendar-shell {
		border-radius: 0.9rem;
		padding: 1rem;
		background: color-mix(in oklab, var(--card-bg) 92%, black 8%);
		border: 1px solid color-mix(in oklab, var(--line-divider) 100%, transparent);
	}

	.event-panel {
		border-radius: 0.9rem;
		padding: 1rem;
		background: color-mix(in oklab, var(--card-bg) 90%, black 10%);
		border: 1px solid color-mix(in oklab, var(--line-divider) 100%, transparent);
	}

	.event-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.event-card {
		display: block;
		padding: 0.9rem 1rem;
		border-radius: 0.75rem;
		background: color-mix(in oklab, var(--card-bg) 95%, white 5%);
		border: 1px solid color-mix(in oklab, var(--line-divider) 100%, transparent);
		transition:
			transform 160ms ease,
			border-color 160ms ease;
	}

	.event-card:hover {
		transform: translateY(-1px);
		border-color: color-mix(in oklab, var(--primary) 42%, transparent);
	}

	.event-card__meta {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin-bottom: 0.5rem;
	}

	.event-card__category {
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
	}

	.event-card__category--ai {
		color: rgb(22, 163, 74);
	}

	.event-card__category--devtools {
		color: rgb(234, 88, 12);
	}

	.event-card__category--frontend {
		color: rgb(37, 99, 235);
	}

	.event-card__category--cloud {
		color: rgb(147, 51, 234);
	}

	.event-card__category--mobile {
		color: rgb(219, 39, 119);
	}

	.event-card h3 {
		margin: 0 0 0.4rem;
		font-size: 1rem;
		font-weight: 700;
	}

	.event-card p,
	.event-card__status,
	.event-panel__empty,
	.event-panel__header p {
		margin: 0.25rem 0 0;
		font-size: 0.9rem;
		color: var(--meta);
	}

	@media (max-width: 1100px) {
		.calendar-layout {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 720px) {
		.event-board {
			padding: 1rem;
		}

		.calendar-shell,
		.event-panel {
			padding: 0.75rem;
		}
	}
</style>
