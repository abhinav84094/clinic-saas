import mongoose from "mongoose";

const { Schema } = mongoose;

// Basic envelope check.
// Actual encryption/decryption paymentTokenCrypto.js handles.
const encryptedTokenSchema = {
  type: String,
  select: false,
  validate: {
    validator(value) {
      return (
        value == null ||
        (
          value.length <= 32768 &&
          /^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+$/.test(
            value
          )
        )
      );
    },
    message: "Invalid encrypted payment credential",
  },
};

function removeSecrets(_document, result) {
  delete result.accessTokenEncrypted;
  delete result.refreshTokenEncrypted;
  return result;
}

const clinicPaymentCredentialSchema = new Schema(
  {
    clinicId: {
      type: Schema.Types.ObjectId,
      ref: "Clinic",
      required: true,
      immutable: true,
      unique: true,
    },

    paymentAccountId: {
      type: Schema.Types.ObjectId,
      ref: "ClinicPaymentAccount",
      required: true,
    },

    merchantAccountId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    mode: {
      type: String,
      enum: ["test", "live"],
      required: true,
    },

    accessTokenEncrypted: {
      ...encryptedTokenSchema,
      required: true,
    },

    refreshTokenEncrypted: {
      ...encryptedTokenSchema,
      default: null,
    },

    // Null means the provider did not supply an expiry.
    // It must not be interpreted as verified perpetual access.
    accessTokenExpiresAt: {
      type: Date,
      default: null,
    },

    scopes: {
      type: [
        {
          type: String,
          trim: true,
          maxlength: 200,
        },
      ],
      default: [],
      validate: {
        validator: (values) => values.length <= 50,
        message: "Too many authorization scopes",
      },
    },

    revokedAt: {
      type: Date,
      default: null,
    },

    lastRefreshedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    strict: "throw",

    // Detect conflicting document saves during token refresh.
    optimisticConcurrency: true,

    toJSON: {
      transform: removeSecrets,
    },

    toObject: {
      transform: removeSecrets,
    },
  }
);

export default mongoose.model(
  "ClinicPaymentCredential",
  clinicPaymentCredentialSchema
);