import { v4 as uuidv4 } from "uuid";

export function createVideo({
  userId,
  title,
  category,
  bucket,
  objectPath
}) {
  return {
    videoId: uuidv4(),
    userId,
    title,
    category,
    bucket,
    objectPath,
    votes: 0,
    createdAt: new Date().toISOString(),
    status: "ACTIVE"
  };
}
