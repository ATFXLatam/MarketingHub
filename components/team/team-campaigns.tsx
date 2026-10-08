"use client";

import { Badge, type BadgeTone } from "@/components/arc/badge/badge";
import { Card } from "@/components/arc/card/card";
import { MondayMark } from "@/components/auth/monday-mark";
import { mondayItemUrl } from "@/lib/board-config";
import { formatDay } from "@/lib/dates";
import type { PublicCampaign } from "@/lib/public-dto";
import { byPhase, type CampaignPhase } from "@/lib/sources";
import styles from "./team-campaigns.module.css";

const PHASE_TONE: Record<CampaignPhase, BadgeTone> = { Live: "success", Planned: "info", Ended: "neutral" };

const where = (campaign: PublicCampaign) => [campaign.channel, campaign.country ?? campaign.region].filter(Boolean).join(" · ") || undefined;
const when = (campaign: PublicCampaign) =>
  campaign.start && campaign.end ? `${formatDay(campaign.start)} to ${formatDay(campaign.end)}` : campaign.start ? `From ${formatDay(campaign.start)}` : "No dates";
const goal = (campaign: PublicCampaign) =>
  campaign.kpi && campaign.target ? `${campaign.kpi}: ${campaign.achieved ?? 0} of ${campaign.target}` : undefined;

/** The campaigns board next to the work: what runs, where, and how it tracks against its goal. Never counts as load. */
export function TeamCampaigns({ campaigns, today, linkToMonday }: { campaigns: PublicCampaign[]; today: string; linkToMonday: boolean }) {
  if (!campaigns.length) return null;
  return (
    <section className={styles.root} aria-labelledby="campaigns-title">
      <h2 id="campaigns-title" className={styles.heading}>Campaigns</h2>
      <div className={styles.grid}>
        {byPhase(campaigns, today).map((campaign) => (
          <Card
            key={campaign.id}
            title={campaign.name}
            description={where(campaign)}
            meta={when(campaign)}
            status={goal(campaign)}
            action={
              <span className={styles.actions}>
                <Badge size="sm" tone={PHASE_TONE[campaign.phase]}>{campaign.phase}</Badge>
                {linkToMonday && (
                  <a className={styles.monday} href={mondayItemUrl("campaigns", campaign.id)} target="_blank" rel="noopener noreferrer" aria-label={`Open ${campaign.name} in monday`} title="Open in monday">
                    <MondayMark size={16} />
                  </a>
                )}
              </span>
            }
          />
        ))}
      </div>
    </section>
  );
}
