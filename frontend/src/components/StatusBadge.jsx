import { CircleAlert, CircleCheck, TriangleAlert } from "lucide-react";

const STATUS = {
  normal: {
    label: "Normal",
    icon: CircleCheck,
    chip: "bg-canopy/10 text-canopy",
  },
  warning: {
    label: "Warning",
    icon: TriangleAlert,
    chip: "bg-honey/15 text-honey",
  },
  critical: {
    label: "Critical",
    icon: CircleAlert,
    chip: "bg-crit/10 text-crit",
  },
};

export function statusMeta(status) {
  return STATUS[status] || STATUS.critical;
}

export default function StatusBadge({ status }) {
  const meta = statusMeta(status);
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${meta.chip}`}>
      <Icon size={13} aria-hidden="true" />
      {meta.label}
    </span>
  );
}
