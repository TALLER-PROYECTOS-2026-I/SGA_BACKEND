import * as jwt from "jsonwebtoken";
import { authRepository } from "./repository";
import {
  Professor,
  LoginResponse,
  MicrosoftJwtPayload,
  SessionResponse,
  UserSession,
} from "./types";
import { AppError } from "../../error";
import { getKey } from "./utils";

class AuthService {
  private verifyMicrosoftToken(token: string): Promise<MicrosoftJwtPayload> {
    return new Promise((resolve, reject) => {
      jwt.verify(
        token,
        getKey,
        {
          algorithms: ["RS256"],
          audience: process.env.AZURE_CLIENT_ID,
          issuer: [
            `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/v2.0`,
            `https://sts.windows.net/${process.env.AZURE_TENANT_ID}/`,
          ],
        },
        (err, decoded) => {
          if (err)
            return reject(new AppError(err.name, "BAD_REQUEST", err.message));
          resolve(decoded as MicrosoftJwtPayload);
        },
      );
    });
  }

  private generateOurJwt(user: Professor, role: number): string {
    const payload: UserSession = {
      id: user.id,
      email: user.correo,
      role: role,
      name: user.nombreDocente,
    };

    return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: "1d" });
  }

  public async login(msToken: string): Promise<LoginResponse> {
    const msPayload = await this.verifyMicrosoftToken(msToken);

    const userEmail = msPayload.preferred_username;
    let userRecord = await authRepository.findUserByEmail(userEmail);

    if (userRecord) {
      await authRepository.updateLastAccess(userRecord.user.id, msPayload);
    } else {
      userRecord = await authRepository.createUser(msPayload);
    }

    const ourToken = this.generateOurJwt(
      userRecord.user,
      userRecord.category.id,
    );

    return {
      token: ourToken,
      user: {
        id: userRecord.user.id,
        email: userRecord.user.correo,
        role: userRecord.category.id,
        name: userRecord.user.nombreDocente,
      },
    };
  }

  public isTokenValid(token: string): boolean {
    try {
      jwt.verify(token, process.env.JWT_SECRET!);
      return true;
    } catch (error) {
      return false;
    }
  }

  public async sessionMe(ourToken: string): Promise<SessionResponse> {
    const decoded = jwt.verify(
      ourToken,
      process.env.JWT_SECRET!,
    ) as UserSession;
    const userId = decoded.id;

    const userAndCategory = await authRepository.findUserByEmail(decoded.email);

    if (!userAndCategory || !userAndCategory.user.activo) {
      throw new AppError("Unauthorized", "UNAUTHORIZED");
    }

    const newToken = this.generateOurJwt(
      userAndCategory.user,
      userAndCategory.category.id,
    );
    await authRepository.updateOnlyLastAccess(userId);

    return {
      token: newToken,
      user: {
        id: userAndCategory.user.id,
        email: userAndCategory.user.correo,
        role: userAndCategory.category.id,
        name: userAndCategory.user.nombreDocente,
      },
    };
  }
}

export const authService = new AuthService();
