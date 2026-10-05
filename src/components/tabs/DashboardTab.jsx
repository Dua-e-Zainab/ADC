import React, { useMemo, useState } from "react";
import { C } from "../../constants/color";
import { fmt } from "../../utils/helper";
import { buildForecast } from "../../utils/forecast";
import {
  Package,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingDown,
  ShoppingCart,
  MapPin,
} from "lucide-react";

const STATUS_COLORS = {
  CRITICAL: "#DC2626",
  WARNING: "#F59E0B",
  REORDER: "#3B82F6",
  HEALTHY: "#10B981",
};

const card = {
  background: "#fff",
  border: `1px solid ${C.border}`,
  borderRadius: 14,
  padding: 18,
  boxShadow: "0 2px 8px rgba(0,0,0,.04)",
};

function Kpi({ icon: Icon, label, value, sub, color }) {
  return (
    <div
      style={{
        ...card,
        display: "flex",
        gap: 14,
        alignItems: "center",
        padding: 22,
        minHeight: 105,
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 12,
          background: `${color}15`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={25} color={color} />
      </div>

      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 800,
            color: C.textFaint,
            textTransform: "uppercase",
            letterSpacing: 0.3,
          }}
        >
          {label}
        </div>

        <div
          style={{
            fontSize: 30,
            fontWeight: 800,
            color,
            fontFamily: "monospace",
            marginTop: 5,
            lineHeight: 1.1,
          }}
        >
          {value}
        </div>

        <div
          style={{
            fontSize: 11,
            color: C.textMuted,
            marginTop: 4,
            lineHeight: 1.3,
          }}
        >
          {sub}
        </div>
      </div>
    </div>
  );
}

function Section({ title, description, children }) {
  return (
    <div style={card}>
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 800,
            color: C.text,
          }}
        >
          {title}
        </div>

        {description && (
          <div
            style={{
              fontSize: 11,
              color: C.textMuted,
              marginTop: 3,
            }}
          >
            {description}
          </div>
        )}
      </div>

      {children}
    </div>
  );
}

function HealthChart({ tally }) {
  const total =
    Object.values(tally).reduce(
      (sum, value) => sum + value,
      0
    ) || 1;

  let current = 0;

  const segments = Object.entries(tally).map(
    ([status, value]) => {
      const start = current;
      current += value;

      return {
        status,
        value,
        start,
        percent: (value / total) * 100,
      };
    }
  );

  const radius = 70;
  const circumference = 2 * Math.PI * radius;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 40,
        flexWrap: "wrap",
      }}
    >
      <div
        style={{
          position: "relative",
          width: 180,
          height: 180,
        }}
      >
        <svg
          width="180"
          height="180"
          viewBox="0 0 180 180"
        >
          <circle
            cx="90"
            cy="90"
            r={radius}
            fill="none"
            stroke="#F1F5F9"
            strokeWidth="22"
          />

          {segments.map((s) => {
            if (!s.value) return null;

            const dash =
              (s.value / total) * circumference;

            const offset =
              -(s.start / total) * circumference +
              circumference * 0.25;

            return (
              <circle
                key={s.status}
                cx="90"
                cy="90"
                r={radius}
                fill="none"
                stroke={STATUS_COLORS[s.status]}
                strokeWidth="22"
                strokeDasharray={`${dash} ${
                  circumference - dash
                }`}
                strokeDashoffset={offset}
                strokeLinecap="butt"
                transform="rotate(-90 90 90)"
              />
            );
          })}
        </svg>

        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <strong
            style={{
              fontSize: 32,
              fontWeight: 800,
            }}
          >
            {total}
          </strong>

          <span
            style={{
              fontSize: 12,
              color: C.textMuted,
              marginTop: 2,
            }}
          >
            Products
          </span>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minWidth: 200,
        }}
      >
        {Object.entries(tally).map(
          ([status, value]) => (
            <div
              key={status}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "11px 0",
                borderBottom: `1px solid ${C.border}`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <span
                  style={{
                    width: 11,
                    height: 11,
                    borderRadius: "50%",
                    background:
                      STATUS_COLORS[status],
                  }}
                />

                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: C.textMid,
                  }}
                >
                  {status === "HEALTHY"
                    ? "Sufficient Stock"
                    : status === "CRITICAL"
                    ? "Critical"
                    : status === "WARNING"
                    ? "Warning"
                    : "Reorder"}
                </span>
              </div>

              <strong
                style={{
                  fontFamily: "monospace",
                  fontSize: 15,
                }}
              >
                {value}
              </strong>
            </div>
          )
        )}
      </div>
    </div>
  );
}

function SiteChart({ data }) {
  const max = Math.max(
    ...data.flatMap((r) => [r.khi, r.lhe]),
    1
  );

  if (!data.length) {
    return (
      <div
        style={{
          color: C.textFaint,
          fontSize: 12,
        }}
      >
        No site data available.
      </div>
    );
  }

  return (
    <div>
      {data.slice(0, 6).map((r) => (
        <div
          key={r.label}
          style={{ marginBottom: 15 }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 5,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: C.textMid,
              }}
            >
              {r.label}
            </span>

            <span
              style={{
                fontSize: 10,
                fontFamily: "monospace",
                color: C.textMuted,
              }}
            >
              {fmt(r.total)}
            </span>
          </div>

          <div
            style={{
              height: 20,
              display: "flex",
              borderRadius: 5,
              overflow: "hidden",
              background: "#F1F5F9",
            }}
          >
            <div
              title={`KHI: ${fmt(r.khi)}`}
              style={{
                width: `${(r.khi / max) * 100}%`,
                background: "#2563EB",
              }}
            />

            <div
              title={`LHE: ${fmt(r.lhe)}`}
              style={{
                width: `${(r.lhe / max) * 100}%`,
                background: "#9333EA",
              }}
            />
          </div>
        </div>
      ))}

      <div
        style={{
          display: "flex",
          gap: 18,
          marginTop: 8,
          fontSize: 10,
          color: C.textMuted,
        }}
      >
        <span>
          <b style={{ color: "#2563EB" }}>●</b> KHI
        </span>

        <span>
          <b style={{ color: "#9333EA" }}>●</b> LHE
        </span>
      </div>
    </div>
  );
}

function OrderPipeline({ pipeline }) {
  const steps = [
    {
      label: "Pending",
      value: pipeline.pending,
      color: C.amber,
      icon: Clock,
    },
    {
      label: "Approved",
      value: pipeline.approved,
      color: C.blue,
      icon: CheckCircle,
    },
    {
      label: "Received",
      value: pipeline.received,
      color: C.green,
      icon: Package,
    },
  ];

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        {steps.map((step, index) => {
          const Icon = step.icon;

          return (
            <React.Fragment key={step.label}>
              <div
                style={{
                  flex: 1,
                  textAlign: "center",
                  padding: "14px 5px",
                  background: `${step.color}10`,
                  borderRadius: 10,
                }}
              >
                <Icon
                  size={18}
                  color={step.color}
                />

                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: step.color,
                    fontFamily: "monospace",
                    marginTop: 4,
                  }}
                >
                  {step.value}
                </div>

                <div
                  style={{
                    fontSize: 10,
                    color: C.textMuted,
                  }}
                >
                  {step.label}
                </div>
              </div>

              {index < steps.length - 1 && (
                <span
                  style={{
                    color: C.textFaint,
                  }}
                >
                  →
                </span>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {pipeline.rejected > 0 && (
        <div
          style={{
            marginTop: 12,
            padding: "8px 10px",
            borderRadius: 7,
            background: "#FEF2F2",
            color: C.red,
            fontSize: 11,
          }}
        >
          {pipeline.rejected} order
          {pipeline.rejected > 1 ? "s" : ""} rejected
        </div>
      )}
    </div>
  );
}

function AttentionList({ items }) {
  if (!items.length) {
    return (
      <div
        style={{
          padding: 16,
          borderRadius: 10,
          background: "#ECFDF5",
          color: "#047857",
          fontSize: 12,
        }}
      >
        ✓ No products currently require urgent
        attention.
      </div>
    );
  }

  return (
    <div>
      {items.map((r) => {
        const color =
          STATUS_COLORS[r.effectiveStatus] ||
          C.blue;

        return (
          <div
            key={r.key}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 0",
              borderBottom: `1px solid ${C.border}`,
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: `${color}12`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <AlertTriangle
                size={16}
                color={color}
              />
            </div>

            <div
              style={{
                flex: 1,
                minWidth: 0,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: C.text,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {r.subProduct ||
                  r.plasticCategory ||
                  "Unknown product"}
              </div>

              <div
                style={{
                  fontSize: 10,
                  color: C.textMuted,
                  marginTop: 2,
                }}
              >
                {r.scheme || "—"} ·{" "}
                {fmt(r.stock)} units available
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  color,
                  fontFamily: "monospace",
                }}
              >
                {r.daysLeft}d
              </div>

              <div
                style={{
                  fontSize: 9,
                  color: C.textFaint,
                }}
              >
                remaining
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SimpleBars({
  rows,
  color,
  showPercentage = false,
}) {
  if (!rows.length) {
    return (
      <div
        style={{
          fontSize: 12,
          color: C.textFaint,
        }}
      >
        No data available.
      </div>
    );
  }

  const total = rows.reduce(
    (sum, r) => sum + (Number(r.value) || 0),
    0
  );

  const max = Math.max(
    ...rows.map((r) => r.value),
    1
  );

  return (
    <div>
      {rows.slice(0, 5).map((r) => {
        const percentage =
          total > 0
            ? Math.round((r.value / total) * 100)
            : 0;

        return (
          <div
            key={r.label}
            style={{
              marginBottom: 11,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 4,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  color: C.textMid,
                  fontWeight: 600,
                }}
              >
                {r.label}
              </span>

              <span
                style={{
                  fontSize: 10,
                  fontFamily: "monospace",
                  color: C.textMuted,
                }}
              >
                {fmt(r.value)}
                {showPercentage &&
                  ` · ${percentage}%`}
              </span>
            </div>

            <div
              style={{
                height: 6,
                borderRadius: 4,
                background: "#F1F5F9",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${(r.value / max) * 100}%`,
                  background: color,
                  borderRadius: 4,
                }}
              />
            </div>
          </div>
        );
      })}

      {rows.length > 5 && (
        <div
          style={{
            marginTop: 4,
            fontSize: 10,
            color: C.textFaint,
          }}
        >
          +{rows.length - 5} more categories
        </div>
      )}
    </div>
  );
}

function groupStock(items, keyFn) {
  const map = {};

  items.forEach((r) => {
    const key = keyFn(r) || "Unknown";

    map[key] =
      (map[key] || 0) + (Number(r.stock) || 0);
  });

  return Object.entries(map)
    .map(([label, value]) => ({
      label,
      value,
    }))
    .sort((a, b) => b.value - a.value);
}

export default function DashboardTab({
  entries = [],
  closing = {},
  orders = {},
  currentSite,
}) {
  const [siteView, setSiteView] = useState("ALL");

  const forecast = useMemo(
    () =>
      buildForecast(
        entries,
        closing,
        orders || {},
        siteView === "ALL" ? null : siteView
      ),
    [entries, closing, orders, siteView]
  );

  /*
   * IMPORTANT:
   * HEALTHY remains the internal status.
   * Only the UI label is changed to "Sufficient Stock".
   *
   * This prevents the forecast/status calculations
   * from changing when the displayed name changes.
   */
  const withStatus = useMemo(
    () =>
      forecast.map((r) => {
        const ord = (orders || {})[r.key];

        const handled = !!(
          ord?.placedAt || ord?.received
        );

        return {
          ...r,
          effectiveStatus: handled
            ? "SUFFICIENT STOCK"
            : r.status,
          handled,
        };
      }),
    [forecast, orders]
  );

  const totals = useMemo(() => {
    const totalStock = withStatus.reduce(
      (sum, r) => {
        if (siteView === "KHI") {
          return sum + (Number(r.khiStock) || 0);
        }

        if (siteView === "LHE") {
          return sum + (Number(r.lheStock) || 0);
        }

        return (
          sum +
          (Number(r.khiStock) || 0) +
          (Number(r.lheStock) || 0)
        );
      },
      0
    );

    const relevantEntries = entries.filter(
      (entry) =>
        siteView === "ALL" ||
        entry.site === siteView
    );

    const uniqueDates = [
      ...new Set(
        relevantEntries
          .map((entry) => entry.date)
          .filter(Boolean)
      ),
    ].sort();

    const totalConsumption =
      relevantEntries.reduce(
        (sum, entry) =>
          sum +
          (Number(entry.totalConsumption) || 0),
        0
      );

    const numberOfDays = Math.max(
      uniqueDates.length,
      1
    );

    const dailyUsage =
      totalConsumption / numberOfDays;

    /*
     * IMPORTANT:
     * Keep HEALTHY as the actual internal key.
     * The UI displays it as "Sufficient Stock".
     */
    const tally = {
      CRITICAL: 0,
      WARNING: 0,
      REORDER: 0,
      HEALTHY: 0,
    };

    withStatus.forEach((r) => {
      /*
       * Handled orders are displayed as sufficient stock,
       * but for the dashboard tally we count them as HEALTHY.
       *
       * This keeps the "Sufficient Stock" count accurate.
       */
      const status = r.handled
        ? "HEALTHY"
        : r.status;

      if (tally[status] !== undefined) {
        tally[status]++;
      }
    });

    const avgCoverDays =
      dailyUsage > 0
        ? totalStock / dailyUsage
        : null;

    const avgCoverMonths =
      avgCoverDays !== null
        ? avgCoverDays / 30
        : null;

    return {
      totalStock,
      totalBurn: dailyUsage,
      totalConsumption,
      numberOfDays,
      totalProducts: withStatus.length,
      healthyProducts: tally.HEALTHY,
      reorderProducts: tally.REORDER,

      avgStockPerProduct:
        withStatus.length > 0
          ? Math.round(
              totalStock /
                withStatus.length
            )
          : 0,

      avgCoverDays,
      avgCoverMonths,
      tally,
    };
  }, [
    entries,
    withStatus,
    siteView,
  ]);

  const orderPipeline = useMemo(() => {
    const list = Object.values(
      orders || {}
    );

    return {
      pending: list.filter(
        (o) =>
          o.approvalStatus ===
            "PENDING" &&
          !o.received
      ).length,

      approved: list.filter(
        (o) =>
          o.approvalStatus ===
            "APPROVED" &&
          !o.received
      ).length,

      rejected: list.filter(
        (o) =>
          o.approvalStatus ===
          "REJECTED"
      ).length,

      received: list.filter(
        (o) => o.received
      ).length,
    };
  }, [orders]);

  const siteCompare = useMemo(() => {
    const map = {};

    forecast.forEach((r) => {
      const key = r.scheme || "Unknown";

      if (!map[key]) {
        map[key] = {
          khi: 0,
          lhe: 0,
        };
      }

      map[key].khi +=
        Number(r.khiStock) || 0;

      map[key].lhe +=
        Number(r.lheStock) || 0;
    });

    return Object.entries(map)
      .map(([label, v]) => ({
        label,
        ...v,
        total: v.khi + v.lhe,
      }))
      .sort(
        (a, b) =>
          b.total - a.total
      );
  }, [forecast]);

  const attentionItems = useMemo(
    () =>
      withStatus
        .filter(
          (r) =>
            r.daysLeft !== null &&
            r.daysLeft !== undefined &&
            !r.handled
        )
        .sort(
          (a, b) =>
            a.daysLeft -
            b.daysLeft
        )
        .slice(0, 5),
    [withStatus]
  );

  const byScheme = useMemo(
    () =>
      groupStock(
        withStatus,
        (r) => r.scheme
      ),
    [withStatus]
  );

  const byCategory = useMemo(
    () =>
      groupStock(
        withStatus,
        (r) =>
          r.plasticCategory
      ),
    [withStatus]
  );

  return (
    <div>
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 15,
          marginBottom: 22,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 23,
              fontWeight: 800,
              color: C.text,
            }}
          >
            Dashboard
          </h1>

          <p
            style={{
              fontSize: 12,
              color: C.textMuted,
              marginTop: 4,
            }}
          >
            A simple overview of your card
            stock health and orders.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            background: "#fff",
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          {["ALL", "KHI", "LHE"].map(
            (site) => (
              <button
                key={site}
                onClick={() =>
                  setSiteView(site)
                }
                style={{
                  border: 0,
                  padding: "8px 14px",
                  cursor: "pointer",
                  background:
                    siteView === site
                      ? C.blue
                      : "#fff",
                  color:
                    siteView === site
                      ? "#fff"
                      : C.textMuted,
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {site === "ALL"
                  ? "Both Sites"
                  : site}
              </button>
            )
          )}
        </div>
      </div>

      {/* KPI CARDS */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(5, minmax(0, 1fr))",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <Kpi
          icon={Package}
          label="Stock Available"
          value={fmt(totals.totalStock)}
          sub="Total units currently available"
          color={C.blue}
        />

        <Kpi
          icon={TrendingDown}
          label="Daily Usage"
          value={fmt(
            Math.round(totals.totalBurn)
          )}
          sub="Average units consumed per day"
          color="#8B5CF6"
        />

        <Kpi
          icon={Clock}
          label="Stock Cover"
          value={
            totals.avgCoverMonths === null
              ? "∞"
              : `${totals.avgCoverMonths.toFixed(
                  1
                )} months`
          }
          sub="Estimated months current stock may last"
          color={
            totals.avgCoverMonths !== null &&
            totals.avgCoverMonths <= 1
              ? C.red
              : C.green
          }
        />

        <Kpi
          icon={AlertTriangle}
          label="Needs Attention"
          value={
            totals.tally.CRITICAL +
            totals.tally.WARNING
          }
          sub="Critical + warning products"
          color={C.red}
        />

        <Kpi
          icon={ShoppingCart}
          label="Pending Orders"
          value={orderPipeline.pending}
          sub="Waiting for approval"
          color={C.amber}
        />

        <Kpi
          icon={AlertTriangle}
          label="Critical"
          value={totals.tally.CRITICAL}
          sub="Products critically low"
          color={C.red}
        />

        <Kpi
          icon={AlertTriangle}
          label="Warning"
          value={totals.tally.WARNING}
          sub="Products needing attention"
          color={C.amber}
        />

        <Kpi
          icon={TrendingDown}
          label="Reorder"
          value={totals.tally.REORDER}
          sub="Products approaching reorder"
          color={C.blue}
        />

        <Kpi
          icon={CheckCircle}
          label="Sufficient Stock"
          value={totals.tally.HEALTHY}
          sub="Products with sufficient stock"
          color={C.green}
        />

        <Kpi
          icon={Package}
          label="Total Products"
          value={withStatus.length}
          sub="Products tracked in inventory"
          color="#0D9488"
        />
      </div>

      {/* HEALTH + ATTENTION */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "minmax(300px, 1fr) minmax(300px, 1fr)",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <Section
          title="Stock Health"
          description="How many products have sufficient stock or need attention?"
        >
          <HealthChart
            tally={totals.tally}
          />
        </Section>

        <Section
          title="Needs Attention"
          description="Products with the least stock cover"
        >
          <AttentionList
            items={attentionItems}
          />
        </Section>
      </div>

      {/* SITE + ORDERS */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "minmax(350px, 1.5fr) minmax(300px, 1fr)",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <Section
          title="Stock by Site"
          description="Compare stock between Karachi and Lahore"
        >
          <SiteChart data={siteCompare} />
        </Section>

        <Section
          title="Order Pipeline"
          description="Where your orders currently stand"
        >
          <OrderPipeline
            pipeline={orderPipeline}
          />
        </Section>
      </div>

      {/* BREAKDOWN */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <Section
          title="Stock by Scheme"
          description="Which schemes hold the most stock?"
        >
          <SimpleBars
            rows={byScheme}
            color="#8B5CF6"
          />
        </Section>

        <Section
          title="Stock by Category"
          description="Current stock distribution"
        >
          <SimpleBars
            rows={byCategory}
            color="#0D9488"
            showPercentage
          />
        </Section>
      </div>

      {/* HELP BOX */}
      <div
        style={{
          padding: 14,
          borderRadius: 12,
          background: "#EFF6FF",
          border: "1px solid #BFDBFE",
          display: "flex",
          gap: 10,
          alignItems: "flex-start",
        }}
      >
        <MapPin size={17} color={C.blue} />

        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: "#1E40AF",
              marginBottom: 3,
            }}
          >
            How to read this dashboard
          </div>

          <div
            style={{
              fontSize: 11,
              color: "#475569",
              lineHeight: 1.6,
            }}
          >
            <b>Stock Available</b> = units
            currently in stock.{" "}

            <b>Daily Usage</b> = average
            units consumed per day.{" "}

            <b>Stock Cover</b> = estimated
            number of months your current
            stock can support normal usage.{" "}

            <b>Total Products</b> = number
            of products currently being
            monitored.{" "}

            <b>Sufficient Stock</b> =
            products currently classified
            as having sufficient stock.{" "}

            <b>Reorder Products</b> =
            products currently requiring
            or approaching reorder.{" "}

            <b>Avg Stock / Product</b> =
            average available units per
            product.{" "}

            <b>Received Orders</b> =
            orders that have been marked
            as received.{" "}

            <b>Critical</b> means stock is
            running low and requires
            attention.
          </div>
        </div>
      </div>
    </div>
  );
}
