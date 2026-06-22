# Architecture Decision Records (Web Terminal)

This directory records significant architecture decisions for the **Shopbook POS Web Terminal**.

An ADR captures a single decision: the context that forced it, the options considered, the choice made, and the consequences we accept. ADRs are immutable once `Accepted` — to change a decision, write a new ADR that supersedes the old one (and update the old one's status to `Superseded by NNNN`).

## Format

We use a lightweight [MADR](https://adr.github.io/madr/)-style template. Copy the structure of an existing record. Filename: `NNNN-short-kebab-title.md` (zero-padded, monotonic).

## Index

| ID                                                    | Title                                                                               | Status   |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------- | -------- |
| [0001](0001-realtime-presence-for-device-tracking.md) | Use Supabase Realtime Presence for live device tracking instead of database polling | Accepted |
