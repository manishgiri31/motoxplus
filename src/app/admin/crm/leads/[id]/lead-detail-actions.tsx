"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ActivityForm } from "@/components/admin/activity-form";
import { ConvertLeadForm } from "@/components/admin/convert-lead-form";
import { Plus, UserCheck } from "lucide-react";

interface Lead {
  id: string;
  status: string;
  companyName: string;
  ownerName: string;
  email: string;
}

export function LeadDetailActions({ lead }: { lead: Lead }) {
  const router = useRouter();
  const [showActivity, setShowActivity] = useState(false);
  const [showConvert, setShowConvert] = useState(false);

  function onSaved() {
    setShowActivity(false);
    router.refresh();
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowConvert(true)}
          className="flex items-center gap-2 bg-green-700 hover:bg-green-600 text-white font-bold px-4 py-2.5 rounded-sm text-sm uppercase tracking-wider transition-colors"
        >
          <UserCheck size={14} /> Convert to Dealer
        </button>
        <button
          onClick={() => setShowActivity(true)}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2.5 rounded-sm text-sm uppercase tracking-wider transition-colors"
        >
          <Plus size={14} /> Log Activity
        </button>
      </div>

      {showActivity && (
        <ActivityForm
          leadId={lead.id}
          currentStatus={lead.status}
          onClose={() => setShowActivity(false)}
          onSaved={onSaved}
        />
      )}
      {showConvert && (
        <ConvertLeadForm
          leadId={lead.id}
          companyName={lead.companyName}
          ownerName={lead.ownerName}
          email={lead.email}
          onClose={() => setShowConvert(false)}
        />
      )}
    </>
  );
}
