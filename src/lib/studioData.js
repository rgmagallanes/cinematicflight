import { apiDelete, apiGet, apiPost, apiUpload } from "./hostingerApi.js";

const parseExternalId = (value) => /^\d+$/.test(value) ? Number(value) : value;

const inquiryToRow = (ownerId, inquiry) => ({
  owner_id: ownerId,
  external_id: String(inquiry.id),
  property_name: inquiry.property,
  contact_name: inquiry.contact,
  contact_email: inquiry.email,
  stage: inquiry.stage,
  activity_label: inquiry.activity,
  next_action: inquiry.next,
  action_status: inquiry.actionStatus || "Upcoming",
  due_label: inquiry.due,
  detail: inquiry.detail || "",
  working_note: inquiry.note || "",
});

const rowToInquiry = (row) => ({
  id: parseExternalId(row.external_id),
  property: row.property_name,
  contact: row.contact_name,
  email: row.contact_email,
  stage: row.stage,
  activity: row.activity_label,
  next: row.next_action,
  actionStatus: row.action_status,
  due: row.due_label,
  detail: row.detail,
  note: row.working_note,
});

export async function loadInquiries(ownerId) {
  void ownerId;
  const payload = await apiGet("inquiries");
  return payload.data.map(rowToInquiry);
}

export async function saveInquiry(ownerId, inquiry) {
  await apiPost("inquiries", { inquiries: [inquiryToRow(ownerId, inquiry)] });
}

export async function seedInquiries(ownerId, inquiries) {
  await apiPost("inquiries", { inquiries: inquiries.map((inquiry) => inquiryToRow(ownerId, inquiry)) });
}

const propertyToRow = (ownerId, property) => ({
  owner_id: ownerId,
  external_id: property.id,
  property_name: property.name,
  stage: property.stage,
  enquiry_id: property.enquiryId,
  received_label: property.received,
  owner_name: property.owner,
  next_action: property.nextAction,
  source_count: property.sourceCount || 0,
  documents: property.documents || [],
});

const rowToProperty = (row) => ({
  id: row.external_id,
  name: row.property_name,
  stage: row.stage,
  enquiryId: row.enquiry_id,
  received: row.received_label,
  owner: row.owner_name,
  nextAction: row.next_action,
  sourceCount: row.source_count,
  documents: row.documents || [],
});

export async function loadPropertyFiles(ownerId) {
  void ownerId;
  const payload = await apiGet("property-files");
  return payload.data.map(rowToProperty);
}

export async function savePropertyFiles(ownerId, properties) {
  await apiPost("property-files", { properties: properties.map((property) => propertyToRow(ownerId, property)) });
}

export async function loadInquiryImages(inquiryId) {
  const payload = await apiGet("inquiry-images", { inquiryId: String(inquiryId) });
  return payload.data;
}

export async function uploadInquiryImages(inquiryId, files) {
  const body = new FormData();
  body.append("inquiryId", String(inquiryId));
  files.forEach((file) => body.append("images[]", file, file.name));
  const payload = await apiUpload("inquiry-images", body);
  return payload.data;
}

export async function deleteInquiryImage(imageId) {
  await apiDelete("inquiry-images", { imageId });
}
