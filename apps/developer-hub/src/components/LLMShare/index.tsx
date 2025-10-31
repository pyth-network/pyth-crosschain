'use client';

import { Copy, Check, OpenAiLogo, Eye, FileText, ArrowSquareOut } from '@phosphor-icons/react/dist/ssr';
import { Select } from '@pythnetwork/component-library/Select';
import { useLogger } from '@pythnetwork/component-library/useLogger';
import { useState } from 'react';

import { ClaudeIcon } from '../../lib/icons';

type LLMShareProps = {
  content: string;
  title: string;
  url: string;
};

type DropdownOption = {
  id: string;
  name: string;
  url?: string;
  icon: React.ComponentType;
  type: 'markdown' | 'llm';
};

const getDropdownOptions = (): DropdownOption[] => [
  {
    id: 'view-markdown',
    name: 'View as Markdown',
    icon: Eye,
    type: 'markdown',
  },
  {
    id: 'download-markdown',
    name: 'Download Markdown',
    icon: FileText,
    type: 'markdown',
  },
  {
    id: 'chatgpt',
    name: 'Ask ChatGPT',
    url: 'https://chat.openai.com',
    icon: OpenAiLogo,
    type: 'llm',
  },
  {
    id: 'claude',
    name: 'Ask Claude',
    url: 'https://claude.ai',
    icon: ClaudeIcon,
    type: 'llm',
  },
];

export function LLMShare({ content, title, url }: LLMShareProps) {
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});
  const [selectedKey, setSelectedKey] = useState<string>('');
  const logger = useLogger();
  const dropdownOptions = getDropdownOptions();

  async function handleCopy(key: string) {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedStates((prev) => ({ ...prev, [key]: true }));
      setTimeout(() => {
        setCopiedStates((prev) => ({ ...prev, [key]: false }));
      }, 1200);
    } catch (error) {
      logger.error(error);
    }
  }

  function handleDownloadMarkdown() {
    const blob = new Blob([content], { type: 'text/markdown' });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    const safeTitle = title.replaceAll(/[^a-zA-Z0-9]/g, '-');
    a.download = `${safeTitle}.md`;
    document.body.append(a);
    a.click();
    for (const anchor of document.body.querySelectorAll('a')) anchor.remove();
    URL.revokeObjectURL(blobUrl);
  }

  function handleViewMarkdown() {
    const blob = new Blob([content], { type: 'text/plain' });
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, '_blank');
    // Clean up the URL after a delay to ensure it opens
    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 1000);
  }

  function handleShare(option: DropdownOption) {
    if (option.type === 'llm' && option.url) {
      const prompt = `Please read and analyze this documentation page:

        Title: ${title}
        URL: ${url}

        Content:
        ${content}

        Please provide a summary and answer any questions I might have about this content.`;
      
      const encodedInstruction = encodeURIComponent(prompt);
      const shareUrl =
        option.name === 'Ask Claude'
          ? `https://claude.ai/new?q=${encodedInstruction}`
          : `${option.url}?q=${encodedInstruction}`;
      
      window.open(shareUrl, '_blank');
    }
  }

  function handleSelectionChange(newKey: string | number) {
    setSelectedKey(String(newKey));
    const option = dropdownOptions.find((o) => o.id === newKey);
    if (option) {
      if (option.type === 'markdown') {
        if (option.id === 'view-markdown') {
          handleViewMarkdown();
        } else if (option.id === 'download-markdown') {
          handleDownloadMarkdown();
        }
      } else {
        handleShare(option);
      }
      // Reset selection after action
      setSelectedKey('');
    }
  }

  return (
    <div className="inline-flex rounded-md border border-border">
      {/* Main copy button */}
      <button
        onClick={() => {
          handleCopy('markdown').catch(() => { /* no-op */ });
        }}
        className="cursor-pointer relative inline-flex items-center gap-2 rounded-l-md rounded-r-none px-2 py-1.5 text-sm font-fono focus:z-10 border-0 shadow-none transition-all duration-150 hover:bg-neutral-150 dark:hover:bg-neutral-700"
        aria-label="Copy page content"
      >
        <span
          className={`inline-flex items-center justify-center rounded p-0.5 transition-all duration-150 ${
            copiedStates.markdown ? '!text-brand-orange' : ''
          }`}
        >
          {copiedStates.markdown ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </span>
        Copy page
      </button>

      {/* Divider */}
      <div className="border-l border-border" />

      {/* Select dropdown trigger */}
      <div className="relative">
        <Select<DropdownOption>
          label="More options"
          buttonLabel=""
          hideLabel
          size="sm"
          variant="outline"
          options={dropdownOptions}
          selectedKey={selectedKey}
          onSelectionChange={handleSelectionChange}
          show={(option) => {
            const Icon = option.icon;
            return (
              <div className="flex items-center gap-2">
                <Icon />
                <span>{option.name}</span>
                {option.type === 'llm' && <ArrowSquareOut className="ml-auto h-3 w-3" />}
              </div>
            );
          }}
          textValue={(option) => option.name}
        />
      </div>
    </div>
  );
}
