import { useState } from "react";
import { CapacityChips, StaffChips } from "@/app/screens/StudioSetup";

export default function TestChips() {
  const [capacity, setCapacity] = useState(1);
  const [staff, setStaff] = useState("");
  return (
    <div className="min-h-screen bg-[#FAF6F1] p-6 space-y-8 max-w-md mx-auto">
      <h1 className="text-xl font-bold text-[#2b2b2b]">Chip inputs test</h1>
      <div className="rounded-xl border border-[#E5DDD3] bg-white p-4 space-y-3">
        <p className="text-sm font-medium text-[#2b2b2b]">Capacity per time slot</p>
        <CapacityChips value={capacity} onChange={setCapacity} />
        <p className="text-xs text-[#7A7068]">Saved value: {capacity}</p>
      </div>
      <div className="rounded-xl border border-[#E5DDD3] bg-white p-4 space-y-3">
        <p className="text-sm font-medium text-[#2b2b2b]">Staff count (optional)</p>
        <StaffChips value={staff} onChange={setStaff} />
        <p className="text-xs text-[#7A7068]">Saved value: {staff === "" ? "null" : staff}</p>
      </div>
    </div>
  );
}
