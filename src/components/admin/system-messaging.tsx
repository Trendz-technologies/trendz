"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { clsx } from "clsx";
import { Info } from "lucide-react";
import { Button, Field, Input, Modal, Select } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { applyApiErrors } from "./system-data";

/** Sub-navigation shared by the three messaging screens. */
export function MessagingTabs() {
  const pathname = usePathname();
  const tabs = [
    { href: "/admin/notifications", label: "All notifications" },
    { href: "/admin/sms", label: "SMS log" },
    { href: "/admin/email", label: "Email log" },
  ];
  return (
    <nav aria-label="Messaging" className="mb-4 flex gap-1 overflow-x-auto rounded-full bg-black/[0.04] p-1 sm:inline-flex">
      {tabs.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={clsx("whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition", active ? "bg-white text-ink shadow-neu" : "text-ink/55 hover:text-ink")}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Long provider errors: one line in the table, full text on hover / focus. */
export function ErrorText({ text }: { text: string | null }) {
  if (!text) return <span className="text-ink/30">—</span>;
  return (
    <span className="line-clamp-2 max-w-xs break-words text-xs text-danger" title={text}>
      {text}
    </span>
  );
}

const schema = z
  .object({
    channel: z.enum(["EMAIL", "SMS"]),
    to: z.string().trim().min(5, "Enter a recipient").max(200),
  })
  .superRefine((v, ctx) => {
    if (v.channel === "EMAIL" && !z.email().safeParse(v.to).success) ctx.addIssue({ code: "custom", path: ["to"], message: "Enter a valid email address" });
    if (v.channel === "SMS" && !/^\+?[\d\s-]{10,16}$/.test(v.to)) ctx.addIssue({ code: "custom", path: ["to"], message: "Enter a valid mobile number" });
  });
type Values = z.infer<typeof schema>;

export function SendTestModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { user } = useAuth();
  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { channel: "EMAIL", to: user?.email ?? "" } });
  const channel = useWatch({ control, name: "channel" });

  const submit = handleSubmit(async (v) => {
    try {
      await api.post("/notifications/test", v);
      void qc.invalidateQueries({ queryKey: ["admin", "notifications"] });
      void qc.invalidateQueries({ queryKey: ["admin", v.channel === "EMAIL" ? "email-logs" : "sms-logs"] });
      toast(`Test ${v.channel === "EMAIL" ? "email" : "SMS"} queued for ${v.to}`);
      onClose();
    } catch (err) {
      applyApiErrors(err, setError, ["channel", "to"]);
    }
  });

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="Send a test message"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={isSubmitting} onClick={submit}>
            Send test
          </Button>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <Field label="Channel" htmlFor="test-channel">
          <Select
            id="test-channel"
            {...register("channel", {
              onChange: (e: { target: { value: string } }) => setValue("to", e.target.value === "EMAIL" ? (user?.email ?? "") : (user?.phone ?? ""), { shouldValidate: false }),
            })}
          >
            <option value="EMAIL">Email</option>
            <option value="SMS">SMS</option>
          </Select>
        </Field>
        <Field label={channel === "EMAIL" ? "Email address" : "Mobile number"} htmlFor="test-to" error={errors.to?.message} required>
          <Input id="test-to" type={channel === "EMAIL" ? "email" : "tel"} inputMode={channel === "EMAIL" ? "email" : "tel"} placeholder={channel === "EMAIL" ? "you@example.com" : "98765 43210"} invalid={!!errors.to} {...register("to")} />
        </Field>
        <p className="flex items-start gap-2 rounded-xl bg-offwhite px-3 py-2.5 text-xs text-ink/60">
          <Info size={14} className="mt-0.5 shrink-0" />
          The message goes through the live provider and appears in the delivery log. If this channel is switched off in Settings → Notifications, the test is skipped.
        </p>
        {errors.root && (
          <p role="alert" className="rounded-xl bg-danger/5 px-3 py-2 text-sm text-danger">
            {errors.root.message}
          </p>
        )}
      </form>
    </Modal>
  );
}
