"use client";

import { forwardRef, useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type FocusEvent, type SelectHTMLAttributes } from "react";
import ReactSelect, { components, createFilter, type ClassNamesConfig, type DropdownIndicatorProps, type GroupBase, type OptionProps, type SelectInstance } from "react-select";
import { clsx } from "clsx";
import { Check, ChevronDown } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";

/*
 * The app's one select, drawn with react-select.
 *
 * It is used exactly like a native <select>: <option> children (or components
 * that render them), `value` / `onChange={(e) => e.target.value}`, or
 * react-hook-form's `{...register("field")}`. To keep all of that working, a
 * hidden native <select> stays the real form control and react-select is the
 * face in front of it:
 *  - the options and the current value are read from that <select>'s DOM, so
 *    whatever rendered the <option>s is picked up;
 *  - choosing an option sets the <select>'s value and fires a real `change`
 *    event, so every existing handler runs unchanged.
 */

interface Choice {
  value: string;
  label: string;
  isDisabled: boolean;
}
type Group = GroupBase<Choice>;
interface View {
  options: (Choice | Group)[];
  value: string;
}

const EMPTY: View = { options: [], value: "" };
// The real `value` accessors, for reading and writing past the watcher below.
const nativeValue = typeof HTMLSelectElement === "undefined" ? null : Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
const watched = new WeakSet<HTMLSelectElement>();
// Above dialogs and drawers, below toasts. (react-select's own styles load after Tailwind, so the
// few utilities that must beat them carry the "!" important flag.)
const MENU_LAYER = "z-[80]!";
// Short lists open as a plain menu; longer ones (states, categories) can be typed into.
const SEARCH_FROM = 9;

const isGroup = (item: Choice | Group): item is Group => "options" in item;
const flatten = (options: (Choice | Group)[]) => options.flatMap((o) => (isGroup(o) ? [...o.options] : [o]));

const toChoice = (option: HTMLOptionElement): Choice => ({ value: option.value, label: option.label, isDisabled: option.disabled });

function read(node: HTMLSelectElement): View {
  const options: (Choice | Group)[] = [];
  for (const child of Array.from(node.children)) {
    if (child instanceof HTMLOptGroupElement) options.push({ label: child.label, options: Array.from(child.querySelectorAll("option"), toChoice) });
    else if (child instanceof HTMLOptionElement) options.push(toChoice(child));
  }
  return { options, value: nativeValue!.get!.call(node) as string };
}

function same(a: View, b: View) {
  if (a.value !== b.value) return false;
  const [x, y] = [flatten(a.options), flatten(b.options)];
  return a.options.length === b.options.length && x.length === y.length && x.every((o, i) => o.value === y[i]!.value && o.label === y[i]!.label && o.isDisabled === y[i]!.isDisabled);
}

/**
 * react-hook-form sets `element.value = …` directly (default values, reset,
 * setValue) and asks the element to focus on a validation error. Neither
 * fires an event, so both are routed through this one element.
 */
function watch(node: HTMLSelectElement, changed: () => void, focus: () => void) {
  if (watched.has(node) || !nativeValue) return;
  watched.add(node);
  Object.defineProperty(node, "value", {
    configurable: true,
    get: () => nativeValue.get!.call(node) as string,
    set: (value: string) => {
      nativeValue.set!.call(node, value);
      changed();
    },
  });
  node.focus = focus;
}

function DropdownIndicator(props: DropdownIndicatorProps<Choice, false, Group>) {
  return (
    <components.DropdownIndicator {...props}>
      <ChevronDown size={16} className={clsx("transition-transform duration-200", props.selectProps.menuIsOpen && "rotate-180")} />
    </components.DropdownIndicator>
  );
}

function Option(props: OptionProps<Choice, false, Group>) {
  return (
    <components.Option {...props}>
      <span className="min-w-0 flex-1 break-words">{props.label}</span>
      {props.isSelected && <Check size={15} strokeWidth={2.25} className="shrink-0 text-accent" />}
    </components.Option>
  );
}

const classNames: ClassNamesConfig<Choice, false, Group> = {
  container: () => "h-full rounded-[inherit]",
  control: ({ isFocused, isDisabled, selectProps }) =>
    clsx(
      "h-full min-h-0! gap-2 rounded-[inherit] border bg-white pl-3.5 pr-3 text-ink transition",
      isDisabled ? "bg-black/[0.03] text-ink/50" : "cursor-pointer! hover:border-black/25",
      selectProps["aria-invalid"] ? "border-danger/60" : isFocused ? "border-accent/60" : "border-black/10",
      isFocused && "ring-4 ring-accent/15",
    ),
  valueContainer: () => "min-w-0",
  singleValue: () => "truncate",
  placeholder: () => "text-ink/35",
  input: () => "text-ink",
  dropdownIndicator: ({ isFocused }) => clsx("transition-colors", isFocused ? "text-ink/70" : "text-ink/40"),
  menuPortal: () => MENU_LAYER,
  // "my" rather than "mt": the menu opens upwards when there is no room below.
  // As wide as the control, plus room for the tick so a label that fits the control does not wrap in the list.
  menu: () => "my-1.5 w-max! min-w-full max-w-[calc(100%+1.75rem)] animate-pop overflow-hidden rounded-2xl border border-black/10 bg-white text-sm text-ink shadow-neu-lg",
  menuList: () => "space-y-0.5 p-1.5",
  group: () => "pt-1",
  groupHeading: () => "px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-ink/45",
  option: ({ isFocused, isSelected, isDisabled }) =>
    clsx(
      "flex! items-center gap-3 rounded-xl px-3 py-2 transition-colors",
      isDisabled ? "cursor-not-allowed! text-ink/30" : "cursor-pointer!",
      isSelected ? "bg-accent/15 font-semibold text-ink" : isFocused && !isDisabled ? "bg-accent/[0.08] text-ink" : !isDisabled && "text-ink/75",
    ),
  noOptionsMessage: () => "px-3 py-5 text-center text-ink/50",
};

const byLabel = createFilter<Choice>({ stringify: (option) => option.label });

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(function Select(
  { className, invalid, children, id, disabled, autoFocus, onBlur, "aria-label": ariaLabel, "aria-labelledby": ariaLabelledBy, ...native },
  ref,
) {
  const { t } = useI18n();
  const instanceId = useId();
  const element = useRef<HTMLSelectElement | null>(null);
  const picker = useRef<SelectInstance<Choice, false, Group> | null>(null);
  const [view, setView] = useState(EMPTY);
  const [open, setOpen] = useState(false);

  const sync = useCallback(() => {
    if (!element.current) return;
    const next = read(element.current);
    setView((current) => (same(current, next) ? current : next));
  }, []);

  const attach = useCallback(
    (node: HTMLSelectElement | null) => {
      element.current = node;
      // Before the form library receives the element, so its first write is already seen.
      if (node) watch(node, sync, () => picker.current?.focus());
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref, sync],
  );

  // After every render: a new `value` prop or new <option>s are in the DOM by now.
  useLayoutEffect(sync);
  // Option helpers that load their own data (<WarehouseOptions />) change the DOM without re-rendering this component.
  useEffect(() => {
    if (!element.current) return;
    const observer = new MutationObserver(sync);
    observer.observe(element.current, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["value", "label", "disabled"] });
    return () => observer.disconnect();
  }, [sync]);

  const choose = (choice: Choice | null) => {
    const node = element.current;
    if (!node || !choice || !nativeValue || read(node).value === choice.value) return;
    nativeValue.set!.call(node, choice.value);
    node.dispatchEvent(new Event("change", { bubbles: true }));
    // A handler may have refused the change; show whatever the <select> holds now.
    sync();
  };

  const selected = flatten(view.options).find((o) => o.value === view.value) ?? null;

  return (
    <div className={clsx("select-box", className)}>
      <select ref={attach} hidden tabIndex={-1} aria-hidden="true" disabled={disabled} {...native}>
        {children}
      </select>
      <ReactSelect<Choice, false, Group>
        ref={picker}
        unstyled
        // Stable hooks for tests and debugging: .select__control, .select__menu, .select__option …
        classNamePrefix="select"
        instanceId={instanceId}
        inputId={id}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-invalid={invalid || undefined}
        autoFocus={autoFocus}
        isDisabled={disabled}
        options={view.options}
        value={selected}
        onChange={choose}
        // react-hook-form's blur handler only needs to know which field it was.
        onBlur={() => element.current && onBlur?.({ type: "blur", target: element.current, currentTarget: element.current } as FocusEvent<HTMLSelectElement>)}
        isSearchable={flatten(view.options).length >= SEARCH_FROM}
        filterOption={byLabel}
        placeholder=""
        noOptionsMessage={() => t("No matches")}
        tabSelectsValue={false}
        // The menu is drawn on <body>, so a dialog, card or scrolling table can never clip it.
        menuPortalTarget={typeof document === "undefined" ? null : document.body}
        menuPosition="fixed"
        menuPlacement="auto"
        maxMenuHeight={288}
        menuShouldScrollIntoView={false}
        onMenuOpen={() => setOpen(true)}
        onMenuClose={() => setOpen(false)}
        // Escape closes the open menu only, not the dialog the select sits in.
        onKeyDown={(e) => open && e.key === "Escape" && e.stopPropagation()}
        classNames={classNames}
        components={{ DropdownIndicator, Option, IndicatorSeparator: null }}
      />
    </div>
  );
});
