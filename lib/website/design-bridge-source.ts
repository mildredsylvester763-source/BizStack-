export const WEBSITE_DESIGN_BRIDGE_PATH = "components/bizstack-design-bridge.tsx";

export const WEBSITE_DESIGN_BRIDGE_SOURCE = `"use client";

import { useEffect } from "react";

type SelectedElement = {
  tag: string;
  text: string;
  id: string;
  className: string;
  selector: string;
  href: string;
  computed: {
    width: string;
    height: string;
    display: string;
    position: string;
    color: string;
    backgroundColor: string;
    fontSize: string;
    fontWeight: string;
    lineHeight: string;
    borderRadius: string;
    padding: string;
    margin: string;
  };
};

function elementSelector(element: Element) {
  const parts: string[] = [];
  let current: Element | null = element;
  let depth = 0;
  while (current && current.nodeType === 1 && depth < 7) {
    const tag = current.tagName.toLowerCase();
    if (current.id) {
      parts.unshift(tag + "#" + CSS.escape(current.id));
      break;
    }
    const parent = current.parentElement;
    if (!parent) {
      parts.unshift(tag);
      break;
    }
    const same = Array.from(parent.children).filter(child => child.tagName === current!.tagName);
    const index = same.indexOf(current) + 1;
    parts.unshift(tag + ":nth-of-type(" + index + ")");
    current = parent;
    depth += 1;
  }
  return parts.join(" > ");
}

function describe(element: Element): SelectedElement {
  const node = element as HTMLElement;
  const text = (node.innerText || node.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 180);
  return {
    tag: element.tagName.toLowerCase(),
    text,
    id: node.id || "",
    className: typeof node.className === "string" ? node.className.slice(0, 240) : "",
    selector: elementSelector(element),
    href: element instanceof HTMLAnchorElement ? element.href : ""
  };
}

export default function BizStackDesignBridge() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("bizstackDesignMode") !== "1") return;

    let last: HTMLElement | null = null;
    const overlay = document.createElement("div");
    overlay.setAttribute("data-bizstack-design-overlay", "true");
    overlay.style.position = "fixed";
    overlay.style.pointerEvents = "none";
    overlay.style.zIndex = "2147483647";
    overlay.style.border = "2px solid rgba(129,140,248,.95)";
    overlay.style.borderRadius = "8px";
    overlay.style.background = "rgba(129,140,248,.06)";
    overlay.style.boxShadow = "0 0 0 1px rgba(255,255,255,.18), 0 8px 30px rgba(79,70,229,.18)";
    overlay.style.display = "none";
    document.documentElement.appendChild(overlay);

    const ignored = (target: Element | null) =>
      !target ||
      target.closest("[data-bizstack-design-overlay]") !== null ||
      target === document.body ||
      target === document.documentElement;

    const send = (type: string, element: Element) => {
      window.parent.postMessage({
        type,
        source: "bizstack-design-bridge",
        element: describe(element),
        href: window.location.href
      }, "*");
    };

    const position = (element: Element) => {
      const rect = element.getBoundingClientRect();
      overlay.style.left = Math.max(0, rect.left - 2) + "px";
      overlay.style.top = Math.max(0, rect.top - 2) + "px";
      overlay.style.width = Math.max(0, rect.width + 4) + "px";
      overlay.style.height = Math.max(0, rect.height + 4) + "px";
    };

    const over = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target.closest("button,a,input,textarea,select,img,section,header,footer,nav,main,h1,h2,h3,h4,h5,h6,p") : null;
      if (ignored(target)) return;
      last = target as HTMLElement;
      position(target);
      overlay.style.display = "block";
      send("bizstack-design-hover", target);
    };

    const move = () => {
      if (last) position(last);
    };

    const out = (event: PointerEvent) => {
      const related = event.relatedTarget instanceof Node ? event.relatedTarget : null;
      if (related && last && last.contains(related)) return;
      overlay.style.display = "none";
      last = null;
    };

    const click = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest("button,a,input,textarea,select,img,section,header,footer,nav,main,h1,h2,h3,h4,h5,h6,p") : null;
      if (ignored(target)) return;
      event.preventDefault();
      event.stopPropagation();
      position(target);
      overlay.style.display = "block";
      send("bizstack-design-select", target);
    };

    document.addEventListener("pointerover", over, true);
    document.addEventListener("pointerout", out, true);
    document.addEventListener("scroll", move, true);
    window.addEventListener("resize", move);
    document.addEventListener("click", click, true);

    return () => {
      document.removeEventListener("pointerover", over, true);
      document.removeEventListener("pointerout", out, true);
      document.removeEventListener("scroll", move, true);
      window.removeEventListener("resize", move);
      document.removeEventListener("click", click, true);
      overlay.remove();
    };
  }, []);

  return null;
}
`;
