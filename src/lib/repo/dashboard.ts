import { query } from "@/lib/db";
import { getAppSettings } from "@/lib/repo/settings";
import { monthsAgoISO } from "@/lib/timezone";

export interface DeaconContact {
  id: string;
  name: string;
  phone: string | null;
}

export interface DashboardStats {
  activeDeaconsCount: number;
  activeDeacons: DeaconContact[];
  guestCount: number;
  absentCount: number;
  absentDeacons: DeaconContact[];
  absencePeriodMonths: number;
}

/** Both tiles exclude Archived deacons (spec §7.2) and Guests (visitors aren't regular roster). */
export async function getDashboardStats(): Promise<DashboardStats> {
  const settings = await getAppSettings();
  const cutoff = monthsAgoISO(settings.absencePeriodMonths);

  const { rows: active } = await query<DeaconContact>(
    `select id, name, phone from deacons where status = 'Active' and not is_guest order by name`
  );

  const { rows: guestRows } = await query<{ count: string }>(
    `select count(*) from deacons where status = 'Active' and is_guest`
  );

  const { rows: absent } = await query<DeaconContact>(
    `select d.id, d.name, d.phone
     from deacons d
     where d.status = 'Active'
       and not d.is_guest
       and not exists (
         select 1 from participation p join liturgies l on l.id = p.liturgy_id
         where p.deacon_id = d.id and l.date >= $1
       )
       and not exists (
         select 1 from archive_participation p join archive_liturgies l on l.id = p.liturgy_id
         where p.deacon_id = d.id and l.date >= $1
       )
     order by d.name`,
    [cutoff]
  );

  return {
    activeDeaconsCount: active.length,
    activeDeacons: active,
    guestCount: Number(guestRows[0].count),
    absentCount: absent.length,
    absentDeacons: absent,
    absencePeriodMonths: settings.absencePeriodMonths,
  };
}
