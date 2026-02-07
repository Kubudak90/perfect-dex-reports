'use client';

import Link from 'next/link';
import {
  Vote,
  Users,
  FileText,
  Clock,
  Shield,
  MessageSquare,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FadeIn, StaggerChildren, StaggerItem } from '@/components/ui/AnimatedComponents';

const plannedFeatures = [
  {
    icon: FileText,
    title: 'Proposal Creation',
    description:
      'Submit on-chain proposals to modify protocol parameters, allocate treasury funds, or introduce new features.',
  },
  {
    icon: Vote,
    title: 'On-Chain Voting',
    description:
      'Vote on active proposals using your governance tokens. Each token equals one vote with transparent, verifiable results.',
  },
  {
    icon: Users,
    title: 'Vote Delegation',
    description:
      'Delegate your voting power to trusted community members who can vote on your behalf.',
  },
  {
    icon: Shield,
    title: 'Timelock Execution',
    description:
      'Approved proposals go through a timelock period before execution, ensuring transparency and security.',
  },
];

const placeholderStats = [
  { label: 'Total Proposals', value: '--', icon: FileText },
  { label: 'Active Votes', value: '--', icon: Vote },
  { label: 'Token Holders', value: '--', icon: Users },
  { label: 'Time to Launch', value: 'TBD', icon: Clock },
];

const communityLinks = [
  {
    label: 'Discord',
    description: 'Join the conversation and stay up to date',
    href: 'https://discord.gg/basebook',
    icon: MessageSquare,
  },
  {
    label: 'Governance Forum',
    description: 'Discuss proposals and share ideas',
    href: 'https://forum.basebook.xyz',
    icon: FileText,
  },
];

export default function GovernancePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <FadeIn>
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Governance</h1>
            <p className="text-muted-foreground">
              Community-driven protocol governance for BaseBook DEX
            </p>
          </div>
        </FadeIn>

        {/* Coming Soon Banner */}
        <FadeIn delay={0.1}>
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-8 mb-8 text-center">
            <div className="inline-flex items-center justify-center rounded-full bg-primary/10 p-4 mb-4">
              <Vote className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-3">Governance is Coming Soon</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto mb-6">
              We are building a fully decentralized governance system that will give the BaseBook
              community direct control over protocol decisions. The governance smart contracts are
              currently in development and will be deployed after a thorough security audit.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button variant="outline" asChild>
                <Link href="https://discord.gg/basebook" target="_blank" rel="noopener noreferrer">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Join Discord
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link
                  href="https://forum.basebook.xyz"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Visit Forum
                </Link>
              </Button>
            </div>
          </div>
        </FadeIn>

        {/* Placeholder Stats */}
        <FadeIn delay={0.15}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {placeholderStats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="rounded-xl border border-border bg-surface p-5 text-center"
                >
                  <div className="flex items-center justify-center mb-2">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-2xl font-bold text-muted-foreground/50">{stat.value}</p>
                  <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
                </div>
              );
            })}
          </div>
        </FadeIn>

        {/* Planned Features */}
        <FadeIn delay={0.2}>
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Planned Features</h2>
            <StaggerChildren>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {plannedFeatures.map((feature) => {
                  const Icon = feature.icon;
                  return (
                    <StaggerItem key={feature.title}>
                      <div className="rounded-xl border border-border bg-surface p-6 h-full">
                        <div className="flex items-start gap-4">
                          <div className="rounded-lg bg-muted p-2.5 shrink-0">
                            <Icon className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <h3 className="font-semibold mb-1">{feature.title}</h3>
                            <p className="text-sm text-muted-foreground">{feature.description}</p>
                          </div>
                        </div>
                      </div>
                    </StaggerItem>
                  );
                })}
              </div>
            </StaggerChildren>
          </div>
        </FadeIn>

        {/* Community Links */}
        <FadeIn delay={0.3}>
          <div>
            <h2 className="text-xl font-semibold mb-4">Get Involved</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {communityLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group rounded-xl border border-border bg-surface p-6 flex items-center justify-between hover:border-primary/40 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="rounded-lg bg-muted p-2.5 shrink-0">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{link.label}</h3>
                        <p className="text-sm text-muted-foreground">{link.description}</p>
                      </div>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                  </Link>
                );
              })}
            </div>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}
