/** Make an SVG independent of the article's styles and inherited CSS variables. */
export function createMermaidPreview(svg: SVGSVGElement): SVGSVGElement {
	const clone = svg.cloneNode(true) as SVGSVGElement;
	const originals = [svg, ...svg.querySelectorAll("*")];
	const copies = [clone, ...clone.querySelectorAll("*")];
	const documentUrl = new URL(svg.ownerDocument.URL);
	documentUrl.hash = "";

	originals.forEach((element, index) => {
		const copy = copies[index];
		if (!(copy instanceof SVGElement || copy instanceof HTMLElement)) {
			return;
		}

		const computed = getComputedStyle(element);
		copy.removeAttribute("style");
		for (const property of computed) {
			if (property.startsWith("--")) continue;
			// Browsers can resolve marker/filter references to the article URL.
			// In the preview they must point to the definitions inside this SVG.
			const value = computed
				.getPropertyValue(property)
				.replace(/url\(["']?([^"')]+)["']?\)/g, (match, reference: string) => {
					const url = new URL(reference, documentUrl);
					const hash = url.hash;
					url.hash = "";
					return hash && url.href === documentUrl.href
						? `url("${hash}")`
						: match;
				});
			copy.style.setProperty(property, value);
		}
	});

	// The computed snapshot already includes Mermaid's embedded rules. Remove
	// them so !important declarations cannot override the resolved values.
	clone.querySelectorAll("style").forEach((style) => {
		style.remove();
	});
	// PhotoSwipe sizes the host; scale the full viewBox to fit that host.
	clone.setAttribute("width", "100%");
	clone.setAttribute("height", "100%");
	clone.style.width = "100%";
	clone.style.height = "100%";
	clone.style.maxWidth = "none";
	clone.style.maxHeight = "none";
	clone.style.margin = "0";

	return clone;
}
