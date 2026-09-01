// Local in-memory + localStorage implementation of CustomerRepository.
// Repository implementations are the ONLY place allowed to touch storage.

import { newId } from "@/core/ids";
import { readJson, writeJson } from "@/core/storage/local-kv";
import { getIdentity } from "@/core/auth/identity";
import { emit } from "@/core/activity/emitter";
import type {
  Contact,
  Customer,
  CustomerCreateInput,
  CustomerListQuery,
  CustomerListResult,
  CustomerRepository,
  Note,
  Tag,
} from "./repository";
import { assertPersisted } from "@/core/storage/persistence";

const K_CUSTOMERS = "skildos.crm.customers.v1";
const K_CONTACTS = "skildos.crm.contacts.v1";
const K_NOTES = "skildos.crm.notes.v1";
const K_TAGS = "skildos.crm.tags.v1";

function computeDisplayName(c: Pick<Customer, "kind" | "businessName" | "firstName" | "lastName">): string {
  if (c.kind === "business") return c.businessName?.trim() || "Unnamed business";
  const name = [c.firstName, c.lastName].filter(Boolean).join(" ").trim();
  return name || "Unnamed customer";
}

function validateCreate(input: CustomerCreateInput): void {
  if (input.kind === "business" && !input.businessName?.trim()) {
    throw new Error("A business customer requires a businessName.");
  }
  if (input.kind === "individual" && !input.firstName?.trim() && !input.lastName?.trim()) {
    throw new Error("An individual customer requires a first or last name.");
  }
  if (input.primaryEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.primaryEmail)) {
    throw new Error("Invalid email address.");
  }
}

export function createLocalCustomerRepository(): CustomerRepository {
  let customers: Customer[] = readJson<Customer[]>(K_CUSTOMERS, []);
  let contacts: Contact[] = readJson<Contact[]>(K_CONTACTS, []);
  let notes: Note[] = readJson<Note[]>(K_NOTES, []);
  let tags: Tag[] = readJson<Tag[]>(K_TAGS, []);

  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());

  const persistCustomers = () => assertPersisted(K_CUSTOMERS, writeJson(K_CUSTOMERS, customers));
  const persistContacts = () => assertPersisted(K_CONTACTS, writeJson(K_CONTACTS, contacts));
  const persistNotes = () => assertPersisted(K_NOTES, writeJson(K_NOTES, notes));
  const persistTags = () => assertPersisted(K_TAGS, writeJson(K_TAGS, tags));

  const findCustomer = (id: string) => customers.find((c) => c.id === id);

  const repo: CustomerRepository = {
    async list(q: CustomerListQuery = {}): Promise<CustomerListResult> {
      let items = customers.slice();
      if (q.status) items = items.filter((c) => c.status === q.status);
      if (q.tagIds?.length) {
        items = items.filter((c) => q.tagIds!.every((t) => c.tagIds.includes(t)));
      }
      if (q.search) {
        const s = q.search.toLowerCase();
        items = items.filter(
          (c) =>
            c.displayName.toLowerCase().includes(s) ||
            c.primaryEmail?.toLowerCase().includes(s) ||
            c.primaryPhone?.toLowerCase().includes(s),
        );
      }
      items.sort((a, b) => b.updatedAt - a.updatedAt);
      const limit = q.limit ?? items.length;
      return { items: items.slice(0, limit) };
    },

    async get(id) {
      return findCustomer(id);
    },

    async create(input) {
      validateCreate(input);
      const now = Date.now();
      const customer: Customer = {
        id: newId(),
        kind: input.kind,
        businessName: input.businessName?.trim() || undefined,
        firstName: input.firstName?.trim() || undefined,
        lastName: input.lastName?.trim() || undefined,
        primaryEmail: input.primaryEmail?.trim() || undefined,
        primaryPhone: input.primaryPhone?.trim() || undefined,
        addresses: input.addresses ?? [],
        tagIds: input.tagIds ?? [],
        status: "active",
        notesCount: 0,
        vehiclesCount: 0,
        createdAt: now,
        updatedAt: now,
        createdBy: getIdentity().id,
        displayName: computeDisplayName({
          kind: input.kind,
          businessName: input.businessName,
          firstName: input.firstName,
          lastName: input.lastName,
        }),
      };
      customers = [customer, ...customers];
      persistCustomers();
      notify();
      emit({
        type: "crm.customer.created",
        moduleId: "crm",
        summary: `Created customer "${customer.displayName}"`,
        payload: { customerId: customer.id },
      });
      return customer;
    },

    async update(id, patch) {
      const existing = findCustomer(id);
      if (!existing) throw new Error(`Customer ${id} not found.`);
      const next: Customer = {
        ...existing,
        ...patch,
        id: existing.id,
        createdAt: existing.createdAt,
        createdBy: existing.createdBy,
        updatedAt: Date.now(),
      };
      next.displayName = computeDisplayName(next);
      customers = customers.map((c) => (c.id === id ? next : c));
      persistCustomers();
      notify();
      emit({
        type: "crm.customer.updated",
        moduleId: "crm",
        summary: `Updated customer "${next.displayName}"`,
        payload: { customerId: id, fields: Object.keys(patch) },
      });
      return next;
    },

    async archive(id) {
      const existing = findCustomer(id);
      if (!existing) throw new Error(`Customer ${id} not found.`);
      const next: Customer = { ...existing, status: "archived", updatedAt: Date.now() };
      customers = customers.map((c) => (c.id === id ? next : c));
      persistCustomers();
      notify();
      emit({
        type: "crm.customer.archived",
        moduleId: "crm",
        summary: `Archived customer "${next.displayName}"`,
        payload: { customerId: id },
      });
      return next;
    },

    async addContact(customerId, contactInput) {
      if (!findCustomer(customerId)) throw new Error(`Customer ${customerId} not found.`);
      if (!contactInput.name?.trim()) throw new Error("Contact name is required.");
      const contact: Contact = {
        id: newId(),
        customerId,
        name: contactInput.name.trim(),
        role: contactInput.role?.trim() || undefined,
        email: contactInput.email?.trim() || undefined,
        phone: contactInput.phone?.trim() || undefined,
        isPrimary: !!contactInput.isPrimary,
      };
      contacts = [...contacts, contact];
      persistContacts();
      notify();
      emit({
        type: "crm.contact.added",
        moduleId: "crm",
        summary: `Added contact "${contact.name}"`,
        payload: { customerId, contactId: contact.id },
      });
      return contact;
    },

    async addNote(customerId, body) {
      const customer = findCustomer(customerId);
      if (!customer) throw new Error(`Customer ${customerId} not found.`);
      const trimmed = body.trim();
      if (!trimmed) throw new Error("Note body is required.");
      const note: Note = {
        id: newId(),
        customerId,
        body: trimmed,
        authorId: getIdentity().id,
        createdAt: Date.now(),
      };
      notes = [note, ...notes];
      persistNotes();
      customers = customers.map((c) =>
        c.id === customerId ? { ...c, notesCount: c.notesCount + 1, updatedAt: Date.now() } : c,
      );
      persistCustomers();
      notify();
      emit({
        type: "crm.note.added",
        moduleId: "crm",
        summary: `Note added on "${customer.displayName}"`,
        payload: { customerId, noteId: note.id },
      });
      return note;
    },

    async listContacts(customerId) {
      return contacts.filter((c) => c.customerId === customerId);
    },

    async listNotes(customerId) {
      return notes.filter((n) => n.customerId === customerId).sort((a, b) => b.createdAt - a.createdAt);
    },

    async listTags() {
      return tags.slice().sort((a, b) => a.label.localeCompare(b.label));
    },

    async upsertTag(input) {
      if (!input.label?.trim()) throw new Error("Tag label is required.");
      const existing = input.id ? tags.find((t) => t.id === input.id) : undefined;
      const tag: Tag = existing
        ? { ...existing, label: input.label.trim(), color: input.color ?? existing.color }
        : { id: newId(), label: input.label.trim(), color: input.color };
      tags = existing ? tags.map((t) => (t.id === tag.id ? tag : t)) : [...tags, tag];
      persistTags();
      notify();
      emit({
        type: "crm.tag.upserted",
        moduleId: "crm",
        summary: `Tag "${tag.label}" saved`,
        payload: { tagId: tag.id },
      });
      return tag;
    },

    async adjustVehiclesCount(customerId, delta) {
      const existing = findCustomer(customerId);
      if (!existing) return;
      const next = { ...existing, vehiclesCount: Math.max(0, existing.vehiclesCount + delta) };
      customers = customers.map((c) => (c.id === customerId ? next : c));
      persistCustomers();
      notify();
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };

  return repo;
}
