import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { Webhook } from "svix";
import prisma from "@/lib/db";

interface ClerkUserEventData {
  id: string;
  email_addresses: Array<{
    email_address: string;
    id: string;
  }>;
  primary_email_address_id: string;
}

interface ClerkWebhookEvent {
  type: string;
  data: ClerkUserEventData;
}

// Clerk webhook handler
// This syncs Clerk users to our database
export async function POST(request: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  // If no webhook secret, log and accept (for development)
  if (!WEBHOOK_SECRET) {
    console.warn("CLERK_WEBHOOK_SECRET not set - accepting webhook without verification");
  }

  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // Get the body
  const payload = await request.json();
  const body = JSON.stringify(payload);

  // Verify webhook if secret is set
  if (WEBHOOK_SECRET && svix_id && svix_timestamp && svix_signature) {
    const wh = new Webhook(WEBHOOK_SECRET);

    try {
      wh.verify(body, {
        "svix-id": svix_id,
        "svix-timestamp": svix_timestamp,
        "svix-signature": svix_signature,
      });
    } catch (err) {
      console.error("Webhook verification failed:", err);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
  }

  const evt = payload as ClerkWebhookEvent;
  const eventType = evt.type;

  console.log(`Clerk webhook received: ${eventType}`);

  try {
    switch (eventType) {
      case "user.created": {
        const { id: clerkUserId, email_addresses, primary_email_address_id } = evt.data;
        const primaryEmail = email_addresses.find(
          (e) => e.id === primary_email_address_id
        );

        if (!primaryEmail) {
          console.error("No primary email found for user");
          return NextResponse.json({ received: true });
        }

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
          where: { clerkUserId },
        });

        if (existingUser) {
          console.log(`User ${clerkUserId} already exists`);
          return NextResponse.json({ received: true });
        }

        // Try to find a matching company by email domain (for automatic linking)
        const emailDomain = primaryEmail.email_address.split("@")[1];
        const company = await prisma.company.findFirst({
          where: {
            name: {
              contains: emailDomain.split(".")[0],
              mode: "insensitive",
            },
          },
        });

        // Create the user - linked to company if found, otherwise unlinked
        // Unlinked users will appear in admin panel for manual assignment
        await prisma.user.create({
          data: {
            clerkUserId,
            email: primaryEmail.email_address,
            role: "viewer", // Default to viewer, admin can upgrade
            companyId: company?.id || null, // null if no matching company
          },
        });

        console.log(`Created user: ${primaryEmail.email_address}${company ? ` (linked to ${company.name})` : ' (unlinked)'}`);
        break;
      }

      case "user.updated": {
        const { id: clerkUserId, email_addresses, primary_email_address_id } = evt.data;
        const primaryEmail = email_addresses.find(
          (e) => e.id === primary_email_address_id
        );

        if (primaryEmail) {
          await prisma.user.updateMany({
            where: { clerkUserId },
            data: {
              email: primaryEmail.email_address,
              lastLoginAt: new Date(),
            },
          });
          console.log(`Updated user: ${clerkUserId}`);
        }
        break;
      }

      case "user.deleted": {
        const { id: clerkUserId } = evt.data;
        await prisma.user.deleteMany({
          where: { clerkUserId },
        });
        console.log(`Deleted user: ${clerkUserId}`);
        break;
      }

      case "session.created": {
        // Update last login time
        const { id: clerkUserId } = evt.data;
        await prisma.user.updateMany({
          where: { clerkUserId },
          data: { lastLoginAt: new Date() },
        });
        break;
      }

      default:
        console.log(`Unhandled webhook type: ${eventType}`);
    }
  } catch (error) {
    console.error("Webhook processing error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
