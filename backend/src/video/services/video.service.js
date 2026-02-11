import { Storage } from "@google-cloud/storage";
import path from "path";

const storage = new Storage({
  keyFilename: path.join(
    process.cwd(),
    "credentials/firebase-admin.json"
  )
});

const bucketName = "paragonplanet-videos";
const bucket = storage.bucket(bucketName);

export async function createSignedUploadUrl({
  userId,
  filename,
  contentType
}) {
  const objectPath = `videos/${userId}/${Date.now()}-${filename}`;
  const file = bucket.file(objectPath);

  const [uploadUrl] = await file.getSignedUrl({
    version: "v4",
    action: "write",
    expires: Date.now() + 10 * 60 * 1000,
    contentType
  });

  return {
    uploadUrl,
    objectPath,
    bucket: bucketName
  };
}
