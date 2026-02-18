'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { useAvatarHeadshot } from '@/hooks/useAvatarHeadshot';
import type { Message } from '@/types/sentiment';
import { getSupabase } from '@/lib/supabase';
import {
  User,
  MessageSquare,
  TrendingUp,
  Shield,
  AlertTriangle,
  Clock,
  UserX,
  Ban,
  History
} from 'lucide-react';
import { moderationApi } from '@/lib/api/sentiment';

interface PlayerDetailsDialogProps {
  message: Message | null;
  isOpen: boolean;
  onClose: () => void;
}

interface PlayerStats {
  totalMessages: number;
  positiveMessages: number;
  negativeMessages: number;
  neutralMessages: number;
  lastSeen: string;
  firstSeen: string;
}

export default function PlayerDetailsDialog({ message, isOpen, onClose }: PlayerDetailsDialogProps) {
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null);
  const [playerMessages, setPlayerMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [moderationLoading, setModerationLoading] = useState<string | null>(null);

  const { url: avatarUrl } = useAvatarHeadshot(message?.player_id?.toString());

  const fetchPlayerStats = async (playerId: number) => {
    setLoading(true);
    try {
      const { data: messages } = await getSupabase()
        .from('messages')
        .select('*')
        .eq('player_id', playerId)
        .order('created_at', { ascending: false });

      if (messages && messages.length > 0) {
        const totalMessages = messages.length;
        const positiveMessages = messages.filter(msg => (msg.sentiment_score || 0) > 25).length;
        const negativeMessages = messages.filter(msg => (msg.sentiment_score || 0) < -25).length;
        const neutralMessages = totalMessages - positiveMessages - negativeMessages;

        setPlayerStats({
          totalMessages,
          positiveMessages,
          negativeMessages,
          neutralMessages,
          lastSeen: messages[0].created_at,
          firstSeen: messages[messages.length - 1].created_at,
        });
        setPlayerMessages(messages);
      }
    } catch (error) {
      console.error('Failed to fetch player stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && message?.player_id) {
      fetchPlayerStats(message.player_id);
    }
  }, [isOpen, message?.player_id]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getSentimentBadgeVariant = (score: number): "default" | "secondary" | "destructive" => {
    if (score > 25) return 'default';
    if (score < -25) return 'destructive';
    return 'secondary';
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleModerationAction = async (action: string) => {
    if (!message?.player_id) return;
    
    setModerationLoading(action);
    try {
      const reason = prompt(`Enter reason for ${action}:`);
      if (!reason) {
        setModerationLoading(null);
        return;
      }
      
      const result = await moderationApi.performAction({
        player_id: message.player_id,
        action,
        reason
      });
      
      if (result.success) {
        console.log(`Successfully ${action}ed player ${message.player_name}`);
        onClose();
      } else {
        console.error(`Failed to ${action} player: ${result.error}`);
      }
    } catch (error) {
      console.error(`Moderation action failed:`, error);
      console.error(`Failed to ${action} player`);
    } finally {
      setModerationLoading(null);
    }
  };

  if (!message) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full sm:max-w-4xl">
        <Tabs defaultValue="details" className="w-full mt-8">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Player Details
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Chat History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4 mt-4">
            {/* Player Info Section */}
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={avatarUrl || undefined} />
                <AvatarFallback className="bg-blue-500 text-white text-sm font-medium">
                  {getInitials(message.player_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h3 className="text-lg font-semibold">{message.player_name}</h3>
                <p className="text-sm text-gray-600">Player ID: {message.player_id}</p>
                {loading ? (
                  <>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      <Skeleton className="h-5 w-20" />
                    </div>
                    <div className="flex gap-4 mt-1">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </>
                ) : playerStats && (
                  <>
                    <div className="flex gap-4 mt-1 text-xs text-gray-500">
                      <span>Last Seen: {formatDate(playerStats.lastSeen)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            <Separator />

            {/* Selected Message */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <MessageSquare className="h-4 w-4" />
                  Selected Message
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-gray-800 text-sm">{message.message}</p>
                </div>
                <div className="flex justify-between items-center mt-3 text-xs">
                  <span className="text-gray-500 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDate(message.created_at)}
                  </span>
                  <Badge variant={getSentimentBadgeVariant(message.sentiment_score)} className="text-xs">
                    Sentiment: {message.sentiment_score > 0 ? '+' : ''}{message.sentiment_score}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Stats and Actions Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Statistics */}
              {loading ? (
                <Card className="lg:col-span-2">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <TrendingUp className="h-4 w-4" />
                      Statistics
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    <div className="space-y-4">
                      {/* Total Messages Skeleton */}
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-6 w-8" />
                        </div>
                      </div>

                      {/* Message Distribution Skeletons */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <Skeleton className="h-4 w-16" />
                          <Skeleton className="h-4 w-6" />
                        </div>
                        <Skeleton className="w-full h-1.5 rounded-full" />
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <Skeleton className="h-4 w-12" />
                          <Skeleton className="h-4 w-6" />
                        </div>
                        <Skeleton className="w-full h-1.5 rounded-full" />
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <Skeleton className="h-4 w-16" />
                          <Skeleton className="h-4 w-6" />
                        </div>
                        <Skeleton className="w-full h-1.5 rounded-full" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : playerStats && (
                <Card className="lg:col-span-2">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <TrendingUp className="h-4 w-4" />
                      Statistics
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    <div className="space-y-4">
                      {/* Message Distribution */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600 text-sm">Positive</span>
                          <span className="font-semibold text-green-600 text-sm">{playerStats.positiveMessages}</span>
                        </div>
                        <Progress value={(playerStats.positiveMessages / playerStats.totalMessages) * 100} className="bg-green-500/20 [&_[data-slot=progress-indicator]]:bg-green-500" />
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600 text-sm">Neutral</span>
                          <span className="font-semibold text-gray-600 text-sm">{playerStats.neutralMessages}</span>
                        </div>
                        <Progress value={(playerStats.neutralMessages / playerStats.totalMessages) * 100} className="bg-gray-500/20 [&_[data-slot=progress-indicator]]:bg-gray-500" />
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600 text-sm">Negative</span>
                          <span className="font-semibold text-red-600 text-sm">{playerStats.negativeMessages}</span>
                        </div>
                        <Progress value={(playerStats.negativeMessages / playerStats.totalMessages) * 100} className="bg-red-500/20 [&_[data-slot=progress-indicator]]:bg-red-500" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Moderation Actions */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Shield className="h-4 w-4" />
                    Moderation Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50" 
                    size="sm"
                    onClick={() => handleModerationAction('warn')}
                    disabled={moderationLoading !== null}
                  >
                    <AlertTriangle className="h-3 w-3 mr-2" />
                    {moderationLoading === 'warn' ? 'Warning...' : 'Warn Player'}
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start text-orange-600 hover:text-orange-700 hover:bg-orange-50" 
                    size="sm"
                    onClick={() => handleModerationAction('kick')}
                    disabled={moderationLoading !== null}
                  >
                    <UserX className="h-3 w-3 mr-2" />
                    {moderationLoading === 'kick' ? 'Kicking...' : 'Kick Player'}
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 border-red-600" 
                    size="sm"
                    onClick={() => handleModerationAction('ban')}
                    disabled={moderationLoading !== null}
                  >
                    <Ban className="h-3 w-3 mr-2" />
                    {moderationLoading === 'ban' ? 'Banning...' : 'Ban Player'}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            {playerMessages.length > 0 ? (
              <ScrollArea className="h-96 rounded-lg border">
                <div className="space-y-3 p-2">
                  {playerMessages.slice(0, 50).map((msg, index) => (
                    <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-sm text-gray-500 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(msg.created_at)}
                        </span>
                        <Badge variant={getSentimentBadgeVariant(msg.sentiment_score)} className="text-xs">
                          {msg.sentiment_score > 0 ? '+' : ''}{msg.sentiment_score}
                        </Badge>
                      </div>
                      <p className="text-gray-800 text-sm">{msg.message}</p>
                    </div>
                  ))}
                  {playerMessages.length > 50 && (
                    <p className="text-xs text-gray-500 text-center py-2">
                      Showing 50 of {playerMessages.length} messages
                    </p>
                  )}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <History className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No chat history available</p>
              </div>
            )}
          </TabsContent>
        </Tabs>

      </DialogContent>
    </Dialog>
  );
} 