"use client";

import { ArrowLeft, User, Trophy, Star, Target } from "lucide-react";
import Link from "next/link";
import { use, useEffect, useState } from "react";

import { Header } from "@/components/Header";
import { HuntCards } from "@/components/HuntCards";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getCreatorProfile, CreatorProfile } from "@/lib/creatorProfiles";
import { getCreatorStats, CreatorStats } from "@/lib/creatorStats";

interface PublicCreatorPageProps {
  params: Promise<{ address: string }>;
}

export default function PublicCreatorPage({ params }: PublicCreatorPageProps) {
  const { address } = use(params);
  const decodedAddress = decodeURIComponent(address ?? "").trim();
  
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [stats, setStats] = useState<CreatorStats | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    setProfile(getCreatorProfile(decodedAddress) || { address: decodedAddress });
    setStats(getCreatorStats(decodedAddress));
  }, [decodedAddress]);

  if (!isClient) return null;

  return (
    <div className="min-h-screen bg-gradient-to-tr from-blue-100 via-purple-100 to-[#f9f9ff] pb-20">
      <Header />

      <div className="mx-auto max-w-[1500px] rounded-4xl bg-white px-6 pb-12 pt-4 sm:px-10">
        <Button
          variant="ghost"
          asChild
          className="mb-8 w-fit px-0 text-slate-700 hover:text-slate-900"
        >
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Arcade
          </Link>
        </Button>

        <div className="mb-12 flex flex-col md:flex-row gap-8 items-start">
          <div className="flex-shrink-0">
            <div className="h-32 w-32 rounded-full bg-slate-100 flex items-center justify-center border-4 border-white shadow-lg overflow-hidden">
              <User className="h-16 w-16 text-slate-400" />
            </div>
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-slate-900 mb-2 truncate" title={decodedAddress}>
              {decodedAddress.slice(0, 8)}...{decodedAddress.slice(-8)}
            </h1>
            
            {profile?.bio ? (
              <p className="text-slate-600 max-w-2xl text-lg mb-6 leading-relaxed">
                {profile.bio}
              </p>
            ) : (
              <p className="text-slate-400 italic max-w-2xl text-lg mb-6">
                This creator hasn't added a bio yet.
              </p>
            )}

            {profile?.links && profile.links.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {profile.links.map((link, idx) => (
                  <a
                    key={idx}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 rounded-full bg-slate-50 border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-colors"
                  >
                    {link.title}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            <Card className="border-none shadow-sm bg-blue-50/50">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
                  <Target className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Hunts Published</p>
                  <p className="text-3xl font-bold text-slate-900">{stats.huntsPublished}</p>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-none shadow-sm bg-purple-50/50">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-3 bg-purple-100 text-purple-600 rounded-lg">
                  <Trophy className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Players Served</p>
                  <p className="text-3xl font-bold text-slate-900">{stats.playersServed}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-amber-50/50">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-3 bg-amber-100 text-amber-600 rounded-lg">
                  <Star className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Average Rating</p>
                  <p className="text-3xl font-bold text-slate-900">
                    {stats.averageRating > 0 ? stats.averageRating.toFixed(1) : "-"}
                    <span className="text-sm font-normal text-slate-500 ml-1">/ 5</span>
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            Active Hunts
            <span className="text-sm font-normal text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
              {stats?.activeHunts.length || 0}
            </span>
          </h2>
          
          {stats?.activeHunts && stats.activeHunts.length > 0 ? (
            // Cast to any because StoredHunt and HuntCard might have slight type differences but structurally similar
            <HuntCards hunts={stats.activeHunts as any} />
          ) : (
            <div className="text-center py-16 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <p className="text-slate-500">This creator doesn't have any active hunts right now.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
