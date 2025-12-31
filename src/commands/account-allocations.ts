import { getRunEnv, invokeTauri, invokeWeb, logger, RUN_ENV } from "@/adapters";
import type { AccountAllocation, NewAccountAllocation, UpdateAccountAllocation } from "@/lib/types";

export const listAccountAllocations = async (
  virtualAccountId: string,
): Promise<AccountAllocation[]> => {
  try {
    switch (getRunEnv()) {
      case RUN_ENV.DESKTOP:
        return invokeTauri("list_account_allocations", { virtualAccountId });
      case RUN_ENV.WEB:
        return invokeWeb("list_account_allocations", { virtualAccountId });
      default:
        throw new Error("Unsupported");
    }
  } catch (e) {
    logger.error("Error listing allocations.");
    throw e;
  }
};

export const createAccountAllocation = async (
  allocation: NewAccountAllocation,
): Promise<AccountAllocation> => {
  try {
    switch (getRunEnv()) {
      case RUN_ENV.DESKTOP:
        return invokeTauri("create_account_allocation", { allocation });
      case RUN_ENV.WEB:
        return invokeWeb("create_account_allocation", { allocation });
      default:
        throw new Error("Unsupported");
    }
  } catch (e) {
    logger.error("Error creating allocation.");
    throw e;
  }
};

export const updateAccountAllocation = async (
  allocationId: string,
  changes: UpdateAccountAllocation,
): Promise<AccountAllocation> => {
  try {
    switch (getRunEnv()) {
      case RUN_ENV.DESKTOP:
        return invokeTauri("update_account_allocation", { allocationId, changes });
      case RUN_ENV.WEB:
        return invokeWeb("update_account_allocation", { allocationId, changes });
      default:
        throw new Error("Unsupported");
    }
  } catch (e) {
    logger.error("Error updating allocation.");
    throw e;
  }
};

export async function deleteAccountAllocation(allocationId: string): Promise<void> {
  switch (getRunEnv()) {
    case RUN_ENV.DESKTOP:
      return invokeTauri("delete_account_allocation", { allocationId });
    case RUN_ENV.WEB:
      return invokeWeb("delete_account_allocation", { allocationId });
    default:
      throw new Error("Unsupported");
  }
}
