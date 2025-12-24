import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/db";

// POST /api/admin/users/sync
// Manually sync all Clerk users to database (for when webhook didn't fire)
export async function POST() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user is admin
  const currentUser = await prisma.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!currentUser || currentUser.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Get all users from Clerk
    const client = await clerkClient();
    const clerkUsers = await client.users.getUserList({ limit: 100 });

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const clerkUser of clerkUsers.data) {
      const email = clerkUser.emailAddresses[0]?.emailAddress;

      if (!email) {
        errors.push(`Skipped user ${clerkUser.id}: no email`);
        continue;
      }

      try {
        // Check if user exists in our database
        const existingUser = await prisma.user.findUnique({
          where: { clerkUserId: clerkUser.id },
        });

        if (existingUser) {
          skipped++;
          continue;
        }

        // Try to find a matching company by email domain
        const emailDomain = email.split("@")[1];
        const company = await prisma.company.findFirst({
          where: {
            name: {
              contains: emailDomain.split(".")[0],
              mode: "insensitive",
            },
          },
        });

        // Create user
        await prisma.user.create({
          data: {
            clerkUserId: clerkUser.id,
            email: email,
            role: "viewer",
            ...(company?.id ? { companyId: company.id } : {}),
          },
        });
        created++;
      } catch (err) {
        errors.push(`Error creating user ${email}: ${err}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Synced users: ${created} created, ${skipped} already existed`,
      created,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Error syncing users:", error);
    return NextResponse.json(
      { error: "Failed to sync users", details: String(error) },
      { status: 500 }
    );
  }
}
