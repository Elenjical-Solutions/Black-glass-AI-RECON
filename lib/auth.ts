import { auth, currentUser } from "@clerk/nextjs/server"

/**
 * Get the authenticated user's ID. Throws if not authenticated.
 */
export async function getAuthUserId(): Promise<string> {
  const { userId } = await auth()
  if (!userId) {
    throw new Error("Unauthorized: Please sign in")
  }
  return userId
}

/**
 * Get the authenticated user's display info.
 */
export async function getAuthUser() {
  const user = await currentUser()
  if (!user) {
    throw new Error("Unauthorized: Please sign in")
  }
  return {
    id: user.id,
    email: user.primaryEmailAddress?.emailAddress ?? "",
    firstName: user.firstName ?? "",
    lastName: user.lastName ?? "",
    fullName: [user.firstName, user.lastName].filter(Boolean).join(" ") || "User",
    imageUrl: user.imageUrl
  }
}
