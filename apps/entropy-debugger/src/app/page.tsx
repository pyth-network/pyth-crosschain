"use client";

import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";

import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import { requestCallback } from "../lib/revelation";
import {
  EntropyDeployments,
  isValidDeployment,
} from "../store/entropy-deployments";

import "highlight.js/styles/github-dark.css"; // You can choose different themes

// Register the bash language
hljs.registerLanguage("bash", bash);

class BaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BaseError";
  }
}

class InvalidTxHashError extends BaseError {
  constructor(message: string) {
    super(message);
    this.name = "InvalidTxHashError";
  }
}

enum TxStateType {
  NotLoaded,
  Loading,
  Success,
  Error,
}

const TxState = {
  NotLoaded: () => ({ status: TxStateType.NotLoaded as const }),
  Loading: () => ({ status: TxStateType.Loading as const }),
  Success: (data: string) => ({ status: TxStateType.Success as const, data }),
  ErrorState: (error: unknown) => ({
    status: TxStateType.Error as const,
    error,
  }),
};

type TxStateContext =
  | ReturnType<typeof TxState.NotLoaded>
  | ReturnType<typeof TxState.Loading>
  | ReturnType<typeof TxState.Success>
  | ReturnType<typeof TxState.ErrorState>;

export default function PythEntropyDebugApp() {
  const [state, setState] = useState<TxStateContext>(TxState.NotLoaded());
  const [isMainnet, setIsMainnet] = useState<boolean>(false);
  const [txHash, setTxHash] = useState<string>("");
  const [error, setError] = useState<BaseError | undefined>(undefined);
  const [selectedChain, setSelectedChain] = useState<
    "" | keyof typeof EntropyDeployments
  >("");

  const validateTxHash = (hash: string) => {
    if (!isValidTxHash(hash) && hash !== "") {
      setError(
        new InvalidTxHashError(
          "Transaction hash must be 64 hexadecimal characters",
        ),
      );
    } else {
      setError(undefined);
    }
    setTxHash(hash);
  };

  const availableChains = useMemo(() => {
    return Object.entries(EntropyDeployments)
      .filter(
        ([, deployment]) =>
          deployment.network === (isMainnet ? "mainnet" : "testnet"),
      )
      .toSorted(([a], [b]) => a.localeCompare(b))
      .map(([key]) => key);
  }, [isMainnet]);

  const oncClickFetchInfo = useCallback(() => {
    if (selectedChain !== "") {
      setState(TxState.Loading());
      requestCallback(txHash, selectedChain)
        .then((data) => {
          setState(TxState.Success(data));
        })
        .catch((error: unknown) => {
          setState(TxState.ErrorState(error));
        });
    }
  }, [txHash, selectedChain]);

  const updateIsMainnet = useCallback(
    (newValue: boolean) => {
      setSelectedChain("");
      setIsMainnet(newValue);
    },
    [setSelectedChain, setIsMainnet],
  );

  const updateSelectedChain = useCallback(
    (chain: string) => {
      if (isValidDeployment(chain)) {
        setSelectedChain(chain);
      }
    },
    [setSelectedChain],
  );

  return (
    <div className="flex flex-col items-center justify-start h-screen">
      <h1 className="text-4xl font-bold mt-8">Pyth Entropy Debug App</h1>

      <div className="flex items-center space-x-2 mt-4">
        <label htmlFor="network-mode">Testnet</label>
        <Switch
          id="network-mode"
          defaultChecked={false}
          onCheckedChange={updateIsMainnet}
        />
        <label htmlFor="network-mode">Mainnet</label>
      </div>
      <div className="mt-4">
        <Select onValueChange={updateSelectedChain} value={selectedChain}>
          <SelectTrigger>
            <SelectValue placeholder="Select Chain" />
          </SelectTrigger>
          <SelectContent>
            {availableChains.map((chain) => (
              <SelectItem key={chain} value={chain}>
                {chain.charAt(0).toUpperCase() +
                  chain.slice(1).replaceAll("-", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="mt-4">
        <label htmlFor="tx-hash" className="mr-2">
          Request Transaction Hash:
        </label>
        <Input
          minLength={64}
          id="tx-hash"
          className={`border rounded p-2 w-full ${error ? "border-red-500" : ""}`}
          placeholder="Enter transaction hash"
          value={txHash}
          onChange={(e) => {
            validateTxHash(e.target.value);
          }}
        />
        {error && <p className="text-red-500 text-sm mt-1">{error.message}</p>}
      </div>
      <div className="mt-4">
        <button
          className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed"
          onClick={oncClickFetchInfo}
          disabled={selectedChain === "" || txHash === ""}
        >
          Fetch Info
        </button>
      </div>
      <Info state={state} />
    </div>
  );
}

const Info = ({ state }: { state: TxStateContext }) => {
  const preRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (preRef.current && state.status === TxStateType.Success) {
      hljs.highlightElement(preRef.current);
    }
  }, [state]);

  switch (state.status) {
    case TxStateType.NotLoaded: {
      return <div>Not loaded</div>;
    }
    case TxStateType.Loading: {
      return <div>Loading...</div>;
    }
    case TxStateType.Success: {
      return (
        <div className="mt-4 p-4 bg-gray-100 rounded w-full max-w-3xl">
          <p className="mb-2">
            Please run the following command in your terminal:
          </p>
          <div className="relative">
            <pre
              ref={preRef}
              className="bg-black text-white p-4 rounded overflow-x-auto whitespace-pre-wrap break-words"
            >
              <code className="language-bash">{state.data}</code>
            </pre>
            <button
              onClick={() => {
                navigator.clipboard.writeText(state.data).catch(() => {
                  /* no-op on error */
                });
              }}
              className="absolute top-2 right-2 bg-gray-700 text-white px-3 py-1 rounded hover:bg-gray-600"
            >
              Copy
            </button>
          </div>
        </div>
      );
    }
    case TxStateType.Error: {
      return (
        <div className="mt-4 p-4 bg-red-100 border border-red-400 rounded">
          <div className="text-red-600">{String(state.error)}</div>
        </div>
      );
    }
  }
};

function isValidTxHash(hash: string) {
  const cleanHash = hash.toLowerCase().replace("0x", "");
  return /^[\da-f]{64}$/.test(cleanHash);
}
