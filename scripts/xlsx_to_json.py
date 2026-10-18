"""
Convert the weekly city-level Excel export into the JSON file the dashboard reads.

Usage:
    pip install openpyxl
    python scripts/xlsx_to_json.py "Executive Dashboard - Dummy - New Country.xlsx" data/executive_weekly_metrics.json

Keeps 31 of the 90 source columns (fleet, drivers/trips, USD collections).
Week dates become YYYY-MM-DD strings; floats are rounded to 2 decimals.
"""
import json
import sys

import openpyxl

KEEP = [
    "week_start", "country", "city",
    # Fleet
    "core_vehicles_on_exit_day", "accessible_vehicles_on_exit_day", "available_vehicles_on_exit_day",
    "assigned_vehicles_on_exit_day", "ready_to_be_assigned_vehicles",
    # Billing / assignment
    "billed_driver_count", "total_billed_days", "total_assigned_days", "non_billed_assigned_days",
    # Drivers & trips
    "newly_assigned_drn_count", "winback_driver_count", "active_drivers", "trip_active_drivers",
    "active_vehicle_count", "trip_active_vehicle_count", "total_trips", "supply_hours",
    # Money (USD so markets add up across currencies)
    "gross_booking_usd", "net_earning_usd", "total_fare_amount_usd", "cycle_remittance_usd",
    "cycle_expected_cash_usd", "cycle_driver_payment_usd", "arrears_repayment_usd",
    "opening_debt_usd", "closing_debt_usd",
    # Churn signal
    "billed_drivers_21_to_14", "unbilled_drivers_last_14",
]


def main(src: str, dst: str, sheet: str | None = None) -> None:
    wb = openpyxl.load_workbook(src, data_only=True, read_only=True)
    ws = wb[sheet] if sheet else wb.worksheets[0]
    rows = ws.iter_rows(values_only=True)
    header = list(next(rows))
    missing = [c for c in KEEP if c not in header]
    if missing:
        sys.exit(f"Missing columns: {missing}")
    idx = [header.index(c) for c in KEEP]

    out = []
    for r in rows:
        if all(v is None for v in r):
            continue
        rec = {}
        for col, i in zip(KEEP, idx):
            v = r[i]
            if col == "week_start":
                v = v.strftime("%Y-%m-%d")
            elif isinstance(v, float):
                v = round(v, 2)
            rec[col] = v
        out.append(rec)

    with open(dst, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"Wrote {len(out)} rows to {dst}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
