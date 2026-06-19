import React from 'react';
import { useLang } from '../context/LangContext';

export default function StatusBadge({ status = 'unknown', dotOnly = false }) {
  const { t } = useLang();

  const STATUS = {
    online:  { dot: 'bg-celadon animate-pulse',   text: 'text-celadon',   key: 'status.online' },
    offline: { dot: 'bg-red-400',                 text: 'text-red-400',   key: 'status.offline' },
    warning: { dot: 'bg-amber-400 animate-pulse', text: 'text-amber-400', key: 'status.warning' },
    error:   { dot: 'bg-red-400',                 text: 'text-red-300',   key: 'status.error' },
    unknown: { dot: 'bg-granite',                 text: 'text-muted',     key: 'status.unknown' },
  };

  const s = STATUS[status] || STATUS.unknown;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${s.text}`}>
      <span className={`w-2 h-2 rounded-full ${s.dot}`} />
      {!dotOnly && t(s.key)}
    </span>
  );
}
