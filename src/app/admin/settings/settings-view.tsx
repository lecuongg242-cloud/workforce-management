"use client";

import * as React from "react";

import { ErrorState } from "@/components/common/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { GeneralSettingsForm } from "@/components/settings/general-settings-form";
import { HolidaysTab } from "@/components/settings/holidays-tab";
import { OvertimeRulesTab } from "@/components/settings/overtime-rules-tab";
import { ShiftRulesTab } from "@/components/settings/shift-rules-tab";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDataQuery } from "@/hooks/use-data-query";
import { useAuthenticatedSession } from "@/lib/auth/session-provider";
import { SETTINGS_LABEL } from "@/lib/constants";
import { getCompanySettings } from "@/lib/data/settings";
import { useDataStore } from "@/lib/data/store";

/**
 * Khung trang cai dat cua Phase 4 — BON tab theo THU TU CO DINH:
 *   Chung (04-01) / Ca lam viec (04-02) / Ngay le (04-03) / Tang ca (04-04).
 *
 * Ba plan sau (04-02/04-03/04-04) da lap noi dung vao cho danh san; thu tu tab
 * giu nguyen tu 04-01.
 *
 * Chan theo vai tro KHONG nam o day: `src/app/admin/layout.tsx` da chuyen
 * huong `manager`/`employee` sang `/employee` truoc khi trang nay render
 * (AUTH-03). Them mot man hinh "khong co quyen" rieng o day se la mot khuon
 * thu hai cho cung mot ranh gioi.
 */
export function SettingsView({ today }: { today: string }): React.ReactElement {
  const session = useAuthenticatedSession();
  const { invalidate } = useDataStore();

  const { data: settings, isLoading, error, reload } = useDataQuery(
    () => getCompanySettings(),
    [session.companyId],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={SETTINGS_LABEL.pageTitle}
        description={SETTINGS_LABEL.pageDescription}
      />

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">{SETTINGS_LABEL.tabGeneral}</TabsTrigger>
          <TabsTrigger value="shifts">{SETTINGS_LABEL.tabShifts}</TabsTrigger>
          <TabsTrigger value="holidays">{SETTINGS_LABEL.tabHolidays}</TabsTrigger>
          <TabsTrigger value="overtime">{SETTINGS_LABEL.tabOvertime}</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardContent className="pt-6">
              {isLoading ? (
                <div className="grid gap-5 md:grid-cols-2">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-9 w-full" />
                    </div>
                  ))}
                </div>
              ) : error ? (
                <ErrorState description={error} onRetry={reload} />
              ) : settings ? (
                <GeneralSettingsForm
                  settings={settings}
                  onSaved={() => {
                    // invalidate() de danh sach "Can xem lai" doc lai theo
                    // nguong moi ngay lan ghe tham ke tiep; reload() de chinh
                    // form nay hien gia tri vua ghi (ke ca khi server chuan
                    // hoa lai mot truong).
                    invalidate();
                    reload();
                  }}
                />
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shifts">
          <Card>
            <CardContent className="pt-6">
              <ShiftRulesTab />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="holidays">
          <Card>
            <CardContent className="pt-6">
              <HolidaysTab today={today} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="overtime">
          <Card>
            <CardContent className="pt-6">
              <OvertimeRulesTab today={today} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
