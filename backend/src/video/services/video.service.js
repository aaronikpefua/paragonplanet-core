import crypto from "node:crypto";

const bucketName = process.env.R2_BUCKET || "paragonplanet-videos";
const region = "auto";
const service = "s3";
const ALLOWED_UPLOAD_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-matroska",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function sanitizeFilename(filename = "upload") {
  return String(filename)
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);
}

function awsEncode(value = "") {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function encodeObjectKey(key) {
  return key.split("/").map(awsEncode).join("/");
}

function getR2Config() {
  const accountId = process.env.R2_ACCOUNT_ID || "";
  const endpoint = (
    process.env.R2_ENDPOINT ||
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "")
  ).replace(/\/$/, "");
  const accessKeyId = process.env.R2_ACCESS_KEY_ID || "";
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || "";
  const publicBaseUrl = (process.env.R2_PUBLIC_BASE_URL || "").replace(/\/$/, "");

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Cloudflare R2 storage is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY."
    );
  }

  return {
    endpoint,
    accessKeyId,
    secretAccessKey,
    publicBaseUrl,
  };
}

function toAmzDate(date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function sha256Hex(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function hmac(key, value, encoding) {
  return crypto.createHmac("sha256", key).update(value, "utf8").digest(encoding);
}

function getSigningKey(secretAccessKey, dateStamp) {
  const dateKey = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, service);
  return hmac(serviceKey, "aws4_request");
}

function canonicalQueryString(params) {
  return Object.keys(params)
    .sort()
    .map((key) => `${awsEncode(key)}=${awsEncode(params[key])}`)
    .join("&");
}

function buildPublicUrl({ publicBaseUrl, endpointOrigin, objectPath }) {
  const publicPath = encodeObjectKey(objectPath);

  if (publicBaseUrl) {
    return `${publicBaseUrl}/${publicPath}`;
  }

  return `${endpointOrigin}/${awsEncode(bucketName)}/${publicPath}`;
}

function createSignedR2Url({ method, objectPath, expiresSeconds = 600 }) {
  const { endpoint, accessKeyId, secretAccessKey, publicBaseUrl } = getR2Config();
  const endpointUrl = new URL(endpoint);
  const now = new Date();
  const amzDate = toAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const canonicalUri = `/${awsEncode(bucketName)}/${encodeObjectKey(objectPath)}`;
  const signedHeaders = "host";

  const queryParams = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${accessKeyId}/${credentialScope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresSeconds),
    "X-Amz-SignedHeaders": signedHeaders,
  };

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString(queryParams),
    `host:${endpointUrl.host}\n`,
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const signature = hmac(
    getSigningKey(secretAccessKey, dateStamp),
    stringToSign,
    "hex"
  );

  const signedQuery = canonicalQueryString({
    ...queryParams,
    "X-Amz-Signature": signature,
  });
  const uploadUrl = `${endpointUrl.origin}${canonicalUri}?${signedQuery}`;

  return {
    url: uploadUrl,
    objectPath,
    bucket: bucketName,
    fileUrl: buildPublicUrl({
      publicBaseUrl,
      endpointOrigin: endpointUrl.origin,
      objectPath,
    }),
  };
}

export async function createSignedUploadUrl({
  userId,
  filename,
  contentType,
}) {
  if (!ALLOWED_UPLOAD_TYPES.has(contentType)) {
    throw new Error("Unsupported upload type");
  }

  const safeFilename = sanitizeFilename(filename);
  const objectPath = `videos/${userId}/${Date.now()}-${safeFilename}`;
  const signed = createSignedR2Url({
    method: "PUT",
    objectPath,
    expiresSeconds: 600,
  });

  return {
    uploadUrl: signed.url,
    objectPath: signed.objectPath,
    bucket: signed.bucket,
    fileUrl: signed.fileUrl,
  };
}

export function createSignedObjectUploadUrl({ objectPath, expiresSeconds = 600 }) {
  return createSignedR2Url({
    method: "PUT",
    objectPath,
    expiresSeconds,
  }).url;
}

export function getPublicUrlForObject(objectPath) {
  const { endpoint, publicBaseUrl } = getR2Config();
  const endpointUrl = new URL(endpoint);

  return buildPublicUrl({
    publicBaseUrl,
    endpointOrigin: endpointUrl.origin,
    objectPath,
  });
}
