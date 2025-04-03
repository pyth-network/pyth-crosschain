"use client";

import { Copy, ChevronDown, ChevronRight } from "lucide-react";
import React, { useState, useEffect } from "react";
import { createPublicClient, http, publicActions } from "viem";
import { bigint } from "zod";

import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { EntropyAbi } from "../lib/entropy-abi";
import { getAllRequests, requestCallback, getRequestBySequenceNumber, getRequestByTransactionHash } from "../lib/revelation";
import { EntropyDeployments } from "../store/entropy-deployments";


type Request = {
  chain: keyof typeof EntropyDeployments;
  network: "mainnet" | "testnet";
  provider: `0x${string}`;
  sequenceNumber: bigint;
  userRandomNumber: `0x${string}`;
  transactionHash: `0x${string}`;
  blockNumber: bigint;
};

type RequestWithStatus = Request & {
  isExpanded: boolean;
  isFulfilled?: boolean;
  isLoading?: boolean;
};

export default function PythEntropyDebugApp() {
  const [requests, setRequests] = useState<RequestWithStatus[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<RequestWithStatus[]>([]);
  const [selectedChain, setSelectedChain] = useState<keyof typeof EntropyDeployments | "">("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  const searchBySequenceNumber = async (sequenceNumber: string) => {
    if (!selectedChain || !sequenceNumber) return;

    setIsSearching(true);
    try {
      const request = await getRequestBySequenceNumber(selectedChain, sequenceNumber);

      if (request) {
        // Check if the request already exists in the list
        const exists = requests.some(
          req => req.chain === selectedChain && req.sequenceNumber === request.sequenceNumber
        );

        if (!exists) {
          const newRequest = { ...request, isExpanded: false };
          setRequests(prev => [...prev, newRequest]);
          setFilteredRequests(prev => [...prev, newRequest]);
        }
      }
    } catch (error) {
      console.error("Error searching for sequence number:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const searchByTransactionHash = async (txHash: string) => {
    if (!selectedChain || !txHash) return;

    setIsSearching(true);
    try {
      const request = await getRequestByTransactionHash(selectedChain, txHash);

      if (request) {
        // Check if the request already exists in the list
        const exists = requests.some(
          req => req.transactionHash.toLowerCase() === txHash.toLowerCase()
        );

        if (!exists) {
          const newRequest = { ...request, isExpanded: false };
          setRequests(prev => [...prev, newRequest]);
          setFilteredRequests(prev => [...prev, newRequest]);
        }
      }
    } catch (error) {
      console.error("Error searching for transaction hash:", error);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const fetchRequests = async () => {
      if (!selectedChain) {
        setRequests([]);
        setFilteredRequests([]);
        return;
      }

      setIsLoading(true);
      try {
        const allRequests = await getAllRequests(selectedChain);
        // Filter out any requests with undefined values
        const validRequests = allRequests.filter(
          (req): req is Request =>
            req.provider !== undefined &&
            req.sequenceNumber !== undefined &&
            req.userRandomNumber !== undefined
        );
        setRequests(validRequests.map(req => ({ ...req, isExpanded: false })));
        setFilteredRequests(validRequests.map(req => ({ ...req, isExpanded: false })));
      } catch (error) {
        console.error("Error fetching requests:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRequests();
  }, [selectedChain]);

  useEffect(() => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();

      // Check if the search term is a valid sequence number
      if (/^\d+$/.test(term)) {
        searchBySequenceNumber(term);
      }
      // Check if the search term is a valid transaction hash
      else if (/^0x[a-fA-F0-9]{64}$/.test(term)) {
        searchByTransactionHash(term);
      }

      // Filter existing requests
      const filtered = requests.filter(
        (req) =>
          req.sequenceNumber.toString().includes(term) ||
          req.transactionHash.toLowerCase().includes(term)
      );
      setFilteredRequests(filtered);
    } else {
      setFilteredRequests(requests);
    }
  }, [requests, searchTerm]);

  const getExplorerUrl = (chain: string, txHash: string) => {
    const deployment = EntropyDeployments[chain as keyof typeof EntropyDeployments];
    if (!deployment) return "#";

    const baseUrl = deployment.network === "mainnet"
      ? deployment.explorer
      : deployment.explorer;

    return `${baseUrl}/tx/${txHash}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const checkRequestFulfillment = async (request: RequestWithStatus) => {
    const deployment = EntropyDeployments[request.chain];
    if (!deployment) return;

    const client = createPublicClient({
      transport: http(deployment.rpc),
    }).extend(publicActions);

    try {
      const requestData = await client.readContract({
        address: deployment.address as `0x${string}`,
        abi: EntropyAbi,
        functionName: "getRequest",
        args: [request.provider, request.sequenceNumber],
      });

      // If the request exists and has been fulfilled, the sequenceNumber will be zero
      const isFulfilled = requestData.sequenceNumber == BigInt(0);

      setRequests(prev => prev.map(req =>
        req.chain === request.chain && req.sequenceNumber === request.sequenceNumber
          ? { ...req, isFulfilled, isLoading: false }
          : req
      ));
    } catch (error) {
      console.error("Error checking request fulfillment:", error);
      setRequests(prev => prev.map(req =>
        req.chain === request.chain && req.sequenceNumber === request.sequenceNumber
          ? { ...req, isLoading: false }
          : req
      ));
    }
  };

  const toggleRow = (request: RequestWithStatus) => {
    setRequests(prev => prev.map(req =>
      req.chain === request.chain && req.sequenceNumber === request.sequenceNumber
        ? { ...req, isExpanded: !req.isExpanded }
        : req
    ));

    if (!request.isExpanded) {
      setRequests(prev => prev.map(req =>
        req.chain === request.chain && req.sequenceNumber === request.sequenceNumber
          ? { ...req, isLoading: true }
          : req
      ));
      checkRequestFulfillment(request);
    }
  };

  return (
    <div className="flex flex-col items-center justify-start min-h-screen p-8">
      <h1 className="text-4xl font-bold mb-8">Pyth Entropy Requests</h1>

      <div className="w-full max-w-6xl space-y-4">
        <div className="flex gap-4">
          <Select
            onValueChange={(value: keyof typeof EntropyDeployments | "") => { setSelectedChain(value); }}
            value={selectedChain}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select Chain" />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(EntropyDeployments).map((chain) => (
                <SelectItem key={chain} value={chain}>
                  {chain.charAt(0).toUpperCase() + chain.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedChain && (
            <div className="flex-1 relative">
              <Input
                placeholder="Search by sequence number or transaction hash"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); }}
                className="flex-1"
              />
              {isSearching && (
                <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500">
                  Searching...
                </div>
              )}
            </div>
          )}
        </div>

        {selectedChain ? (isLoading ? (
          <div className="text-center py-8">Loading requests...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-3 text-left">Chain</th>
                  <th className="p-3 text-left">Sequence Number</th>
                  <th className="p-3 text-left">Provider</th>
                  <th className="p-3 text-left">Transaction Hash</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((request) => (
                  <React.Fragment key={`${request.chain}-${request.provider}-${request.sequenceNumber}-fragment`}>
                    <tr
                      key={`${request.chain}-${request.provider}-${request.sequenceNumber}`}
                      className="border-t cursor-pointer hover:bg-gray-50"
                      onClick={() => { toggleRow(request); }}
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {request.isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          <span
                            className={`px-2 py-1 rounded-full text-xs ${
                              request.network === "mainnet"
                                ? "bg-green-100 text-green-800"
                                : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {request.chain}
                          </span>
                        </div>
                      </td>
                      <td className="p-3">{request.sequenceNumber.toString()}</td>
                      <td className="p-3 font-mono">{request.provider}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <a
                            href={getExplorerUrl(request.chain, request.transactionHash)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline font-mono"
                            onClick={(e) => { e.stopPropagation(); }}
                          >
                            {request.transactionHash.slice(0, 8)}...{request.transactionHash.slice(-6)}
                          </a>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(request.transactionHash);
                            }}
                            className="p-1 hover:bg-gray-100 rounded"
                            title="Copy transaction hash"
                          >
                            <Copy className="w-4 h-4 text-gray-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {request.isExpanded && (
                      <tr key={`${request.chain}-${request.provider}-${request.sequenceNumber}-expanded`}
                          className="border-t">
                        <td colSpan={4} className="p-4 bg-gray-50">
                          {request.isLoading ? (
                            <div className="text-center">Loading...</div>
                          ) : (
                            <div className="space-y-2">
                              <div className="font-medium">
                                Status: {request.isFulfilled ? "Fulfilled" : "Not Fulfilled"}
                              </div>
                              {!request.isFulfilled && (
                                <div className="mt-2">
                                  <div className="font-medium mb-1">Retry Command:</div>
                                  <div className="bg-gray-100 p-2 rounded font-mono text-sm">
                                    { /* TODO: put in retry command here  */ }
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )) : (
          <div className="text-center py-8 text-gray-500">
            Please select a chain to view requests
          </div>
        )}
      </div>
    </div>
  );
}
