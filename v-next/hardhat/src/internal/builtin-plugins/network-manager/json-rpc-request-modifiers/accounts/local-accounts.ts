import type {
  EthereumProvider,
  JsonRpcRequest,
  JsonRpcResponse,
} from "../../../../../types/providers.js";

import {
  assertHardhatInvariant,
  HardhatError,
} from "@ignored/hardhat-vnext-errors";
import { toBigInt } from "@ignored/hardhat-vnext-utils/bigint";
import {
  bytesToHexString,
  hexStringToBigInt,
  hexStringToBytes,
} from "@ignored/hardhat-vnext-utils/hex";
import * as t from "io-ts";
import { addr, Transaction } from "micro-eth-signer";
import * as typed from "micro-eth-signer/typed-data";
import { signTyped } from "micro-eth-signer/typed-data";

import { getRequestParams } from "../../json-rpc.js";
import { ChainId } from "../chain-id/chain-id.js";

import { rpcAddress, rpcData } from "./rpc.js";
import {
  rpcTransactionRequest,
  type RpcTransactionRequest,
} from "./tx-request.js";
import { validateParams } from "./validate.js";

export class LocalAccounts extends ChainId {
  readonly #addressToPrivateKey: Map<string, Uint8Array> = new Map();

  constructor(
    provider: EthereumProvider,
    localAccountsHexPrivateKeys: string[],
  ) {
    super(provider);

    this.#initializePrivateKeys(localAccountsHexPrivateKeys);
  }

  public async resolveRequest(
    jsonRpcRequest: JsonRpcRequest,
  ): Promise<JsonRpcResponse | null> {
    if (
      jsonRpcRequest.method === "eth_accounts" ||
      jsonRpcRequest.method === "eth_requestAccounts"
    ) {
      return this.#createJsonRpcResponse(jsonRpcRequest.id, [
        ...this.#addressToPrivateKey.keys(),
      ]);
    }

    const params = getRequestParams(jsonRpcRequest);

    if (jsonRpcRequest.method === "eth_sign") {
      if (params.length > 0) {
        const [address, data] = validateParams(params, rpcAddress, rpcData);

        if (address !== undefined) {
          if (data === undefined) {
            throw new HardhatError(
              HardhatError.ERRORS.NETWORK.ETHSIGN_MISSING_DATA_PARAM,
            );
          }

          const privateKey = this.#getPrivateKeyForAddress(address);
          return this.#createJsonRpcResponse(
            jsonRpcRequest.id,
            typed.personal.sign(data, privateKey),
          );
        }
      }
    }

    if (jsonRpcRequest.method === "personal_sign") {
      if (params.length > 0) {
        const [data, address] = validateParams(params, rpcData, rpcAddress);

        if (data !== undefined) {
          if (address === undefined) {
            throw new HardhatError(
              HardhatError.ERRORS.NETWORK.PERSONALSIGN_MISSING_ADDRESS_PARAM,
            );
          }

          const privateKey = this.#getPrivateKeyForAddress(address);
          return this.#createJsonRpcResponse(
            jsonRpcRequest.id,
            typed.personal.sign(data, privateKey),
          );
        }
      }
    }

    if (jsonRpcRequest.method === "eth_signTypedData_v4") {
      const [address, data] = validateParams(params, rpcAddress, t.any);

      if (data === undefined) {
        throw new HardhatError(
          HardhatError.ERRORS.NETWORK.ETHSIGN_MISSING_DATA_PARAM,
        );
      }

      let typedMessage = data;
      if (typeof data === "string") {
        try {
          typedMessage = JSON.parse(data);
        } catch {
          throw new HardhatError(
            HardhatError.ERRORS.NETWORK.ETHSIGN_TYPED_DATA_V4_INVALID_DATA_PARAM,
          );
        }
      }

      // if we don't manage the address, the method is forwarded
      const privateKey = this.#getPrivateKeyForAddressOrNull(address);
      if (privateKey !== null) {
        return this.#createJsonRpcResponse(
          jsonRpcRequest.id,
          signTyped(typedMessage, privateKey),
        );
      }
    }

    return null;
  }

  public async modifyRequest(jsonRpcRequest: JsonRpcRequest): Promise<void> {
    const params = getRequestParams(jsonRpcRequest);

    if (jsonRpcRequest.method === "eth_sendTransaction" && params.length > 0) {
      const [txRequest] = validateParams(params, rpcTransactionRequest);

      if (txRequest.gas === undefined) {
        throw new HardhatError(
          HardhatError.ERRORS.NETWORK.MISSING_TX_PARAM_TO_SIGN_LOCALLY,
          { param: "gas" },
        );
      }

      if (txRequest.from === undefined) {
        throw new HardhatError(
          HardhatError.ERRORS.NETWORK.MISSING_TX_PARAM_TO_SIGN_LOCALLY,
          { param: "from" },
        );
      }

      const hasGasPrice = txRequest.gasPrice !== undefined;
      const hasEip1559Fields =
        txRequest.maxFeePerGas !== undefined ||
        txRequest.maxPriorityFeePerGas !== undefined;

      if (!hasGasPrice && !hasEip1559Fields) {
        throw new HardhatError(
          HardhatError.ERRORS.NETWORK.MISSING_FEE_PRICE_FIELDS,
        );
      }

      if (hasGasPrice && hasEip1559Fields) {
        throw new HardhatError(
          HardhatError.ERRORS.NETWORK.INCOMPATIBLE_FEE_PRICE_FIELDS,
        );
      }

      if (hasEip1559Fields && txRequest.maxFeePerGas === undefined) {
        throw new HardhatError(
          HardhatError.ERRORS.NETWORK.MISSING_TX_PARAM_TO_SIGN_LOCALLY,
          { param: "maxFeePerGas" },
        );
      }

      if (hasEip1559Fields && txRequest.maxPriorityFeePerGas === undefined) {
        throw new HardhatError(
          HardhatError.ERRORS.NETWORK.MISSING_TX_PARAM_TO_SIGN_LOCALLY,
          { param: "maxPriorityFeePerGas" },
        );
      }

      if (txRequest.nonce === undefined) {
        txRequest.nonce = await this.#getNonce(txRequest.from);
      }

      const privateKey = this.#getPrivateKeyForAddress(txRequest.from);

      const chainId = await this.getChainId();

      const rawTransaction = await this.#getSignedTransaction(
        txRequest,
        chainId,
        privateKey,
      );

      jsonRpcRequest.method = "eth_sendRawTransaction";
      jsonRpcRequest.params = [bytesToHexString(rawTransaction)];
    }
  }

  #initializePrivateKeys(localAccountsHexPrivateKeys: string[]) {
    const privateKeys: Uint8Array[] = localAccountsHexPrivateKeys.map((h) =>
      hexStringToBytes(h),
    );

    for (const pk of privateKeys) {
      const address = addr.fromPrivateKey(pk).toLowerCase();
      this.#addressToPrivateKey.set(address, pk);
    }
  }

  #getPrivateKeyForAddress(address: Uint8Array): Uint8Array {
    const pk = this.#addressToPrivateKey.get(bytesToHexString(address));
    if (pk === undefined) {
      throw new HardhatError(HardhatError.ERRORS.NETWORK.NOT_LOCAL_ACCOUNT, {
        account: bytesToHexString(address),
      });
    }

    return pk;
  }

  #getPrivateKeyForAddressOrNull(address: Uint8Array): Uint8Array | null {
    try {
      return this.#getPrivateKeyForAddress(address);
    } catch {
      return null;
    }
  }

  async #getNonce(address: Uint8Array): Promise<bigint> {
    const response = await this.provider.request({
      method: "eth_getTransactionCount",
      params: [bytesToHexString(address), "pending"],
    });

    assertHardhatInvariant(
      typeof response === "string",
      "response should be a string",
    );

    return hexStringToBigInt(response);
  }

  async #getSignedTransaction(
    transactionRequest: RpcTransactionRequest,
    chainId: number,
    privateKey: Uint8Array,
  ): Promise<Uint8Array> {
    const txData = {
      ...transactionRequest,
      gasLimit: transactionRequest.gas,
    };

    const accessList = txData.accessList?.map(({ address, storageKeys }) => {
      return {
        address: addr.addChecksum(address.toString("hex")),
        storageKeys:
          storageKeys !== null ? storageKeys.map((k) => k.toString("hex")) : [],
      };
    });

    const checksummedAddress = addr.addChecksum(
      txData.to !== undefined ? txData.to.toString("hex").toLowerCase() : "0x0",
    );

    assertHardhatInvariant(
      txData.nonce !== undefined,
      "nonce should be defined",
    );

    let transaction;
    if (txData.maxFeePerGas !== undefined) {
      transaction = Transaction.prepare({
        type: "eip1559",
        to: checksummedAddress,
        nonce: txData.nonce,
        chainId: txData.chainId ?? toBigInt(chainId),
        value: txData.value !== undefined ? txData.value : 0n,
        data: txData.data !== undefined ? txData.data.toString("hex") : "",
        gasLimit: txData.gasLimit,
        maxFeePerGas: txData.maxFeePerGas,
        maxPriorityFeePerGas: txData.maxPriorityFeePerGas,
        accessList: accessList ?? [],
      });
    } else if (accessList !== undefined) {
      transaction = Transaction.prepare({
        type: "eip2930",
        to: checksummedAddress,
        nonce: txData.nonce,
        chainId: txData.chainId ?? toBigInt(chainId),
        value: txData.value !== undefined ? txData.value : 0n,
        data: txData.data !== undefined ? txData.data.toString("hex") : "",
        gasPrice: txData.gasPrice ?? 0n,
        gasLimit: txData.gasLimit,
        accessList,
      });
    } else {
      transaction = Transaction.prepare({
        type: "legacy",
        to: checksummedAddress,
        nonce: txData.nonce,
        chainId: txData.chainId ?? toBigInt(chainId),
        value: txData.value !== undefined ? txData.value : 0n,
        data: txData.data !== undefined ? txData.data.toString("hex") : "",
        gasPrice: txData.gasPrice ?? 0n,
        gasLimit: txData.gasLimit,
      });
    }

    const signedTransaction = transaction.signBy(privateKey);

    return signedTransaction.toRawBytes();
  }

  #createJsonRpcResponse(
    id: number | string,
    result: unknown,
  ): JsonRpcResponse {
    return {
      jsonrpc: "2.0",
      id,
      result,
    };
  }
}
