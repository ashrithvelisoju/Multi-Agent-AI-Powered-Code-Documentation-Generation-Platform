import mongoose from "mongoose";

export async function connectDB() {
  if (!process.env.MONGODB_URI) {
    console.warn("MONGODB_URI is not set. Please provide it in the Secrets tab.");
    return;
  }

  // Mask credentials for logging
  const maskedURI = process.env.MONGODB_URI.replace(/:([^:@]+)@/, ":****@");
  console.log(`Attempting to connect to MongoDB at: ${maskedURI}`);

  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
    });
    console.log("Connected to MongoDB");
  } catch (error: any) {
    console.error("MongoDB connection error details:", {
      message: error.message,
      code: error.code,
      name: error.name
    });
    
    // Check for common localhost issues
    if (error.message.includes("127.0.0.1") || error.message.includes("localhost")) {
      console.error(`
      CRITICAL ERROR: It looks like you are trying to connect to a local MongoDB instance (${maskedURI}).
      Please ensure MongoDB is running locally, or provide a valid connection string to a REMOTE MongoDB database (e.g., MongoDB Atlas).
      `);
    }

    // Don't exit process, just let it fail gracefully so we can see logs
    // process.exit(1); 
  }
}
