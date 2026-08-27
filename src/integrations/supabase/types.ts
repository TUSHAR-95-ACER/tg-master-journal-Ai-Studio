export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      ai_insights_cache: {
        Row: {
          created_at: string
          id: string
          insights: Json
          page: string
          payload_hash: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          insights: Json
          page: string
          payload_hash: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          insights?: Json
          page?: string
          payload_hash?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string | null
          created_at: string
          id: string
          parts: Json | null
          role: string
          thread_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          parts?: Json | null
          role: string
          thread_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          parts?: Json | null
          role?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_threads: {
        Row: {
          created_at: string
          id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_plan_history: {
        Row: {
          created_at: string
          id: string
          plan_id: string
          schema_version: number | null
          snapshot: Json
          source_updated_at: string | null
          user_id: string
          version: number
        }
        Insert: {
          created_at?: string
          id?: string
          plan_id: string
          schema_version?: number | null
          snapshot: Json
          source_updated_at?: string | null
          user_id: string
          version: number
        }
        Update: {
          created_at?: string
          id?: string
          plan_id?: string
          schema_version?: number | null
          snapshot?: Json
          source_updated_at?: string | null
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      daily_plans: {
        Row: {
          analysis_video_url: string | null
          created_at: string
          daily_bias: string
          date: string
          day_summary: Json | null
          id: string
          max_trades: number
          news_items: Json | null
          note: string | null
          notes_journal: Json | null
          pair_count: number
          pairs: Json | null
          result_chart_image: string | null
          result_narrative: string | null
          review_video: Json | null
          reviewed: boolean | null
          revision: number
          risk_limit: string | null
          schema_version: number | null
          session_focus: string
          took_trades: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          analysis_video_url?: string | null
          created_at?: string
          daily_bias?: string
          date: string
          day_summary?: Json | null
          id: string
          max_trades?: number
          news_items?: Json | null
          note?: string | null
          notes_journal?: Json | null
          pair_count?: number
          pairs?: Json | null
          result_chart_image?: string | null
          result_narrative?: string | null
          review_video?: Json | null
          reviewed?: boolean | null
          revision?: number
          risk_limit?: string | null
          schema_version?: number | null
          session_focus?: string
          took_trades?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          analysis_video_url?: string | null
          created_at?: string
          daily_bias?: string
          date?: string
          day_summary?: Json | null
          id?: string
          max_trades?: number
          news_items?: Json | null
          note?: string | null
          notes_journal?: Json | null
          pair_count?: number
          pairs?: Json | null
          result_chart_image?: string | null
          result_narrative?: string | null
          review_video?: Json | null
          reviewed?: boolean | null
          revision?: number
          risk_limit?: string | null
          schema_version?: number | null
          session_focus?: string
          took_trades?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      macro_analyses: {
        Row: {
          actual_outcome: string | null
          ai_enriched: Json | null
          analysis_date: string
          confidence_level: string | null
          conflict_signals: Json | null
          created_at: string
          cycle_id: string | null
          dovish_probability: number | null
          environment: string | null
          expectation_pricing: string | null
          fed_bias: string | null
          fed_confidence: number | null
          fed_cycle: string | null
          future_probabilities: Json | null
          gold_bias: string | null
          gold_confidence: number | null
          hawkish_probability: number | null
          id: string
          inflation_pressure: string | null
          interpretation: string | null
          macro_theme: string | null
          market_focus: string | null
          narrative: string | null
          narrative_shift: string | null
          outcome_accurate: boolean | null
          outcome_status: string | null
          positioning_risk: string | null
          predicted_outcome: string | null
          rate_cut_probability: number | null
          rate_hike_probability: number | null
          recession_risk: number | null
          smart_money_view: string | null
          source_event_ids: Json | null
          trade_filter: string | null
          updated_at: string
          usd_bias: string | null
          usd_confidence: number | null
          user_id: string
        }
        Insert: {
          actual_outcome?: string | null
          ai_enriched?: Json | null
          analysis_date?: string
          confidence_level?: string | null
          conflict_signals?: Json | null
          created_at?: string
          cycle_id?: string | null
          dovish_probability?: number | null
          environment?: string | null
          expectation_pricing?: string | null
          fed_bias?: string | null
          fed_confidence?: number | null
          fed_cycle?: string | null
          future_probabilities?: Json | null
          gold_bias?: string | null
          gold_confidence?: number | null
          hawkish_probability?: number | null
          id?: string
          inflation_pressure?: string | null
          interpretation?: string | null
          macro_theme?: string | null
          market_focus?: string | null
          narrative?: string | null
          narrative_shift?: string | null
          outcome_accurate?: boolean | null
          outcome_status?: string | null
          positioning_risk?: string | null
          predicted_outcome?: string | null
          rate_cut_probability?: number | null
          rate_hike_probability?: number | null
          recession_risk?: number | null
          smart_money_view?: string | null
          source_event_ids?: Json | null
          trade_filter?: string | null
          updated_at?: string
          usd_bias?: string | null
          usd_confidence?: number | null
          user_id: string
        }
        Update: {
          actual_outcome?: string | null
          ai_enriched?: Json | null
          analysis_date?: string
          confidence_level?: string | null
          conflict_signals?: Json | null
          created_at?: string
          cycle_id?: string | null
          dovish_probability?: number | null
          environment?: string | null
          expectation_pricing?: string | null
          fed_bias?: string | null
          fed_confidence?: number | null
          fed_cycle?: string | null
          future_probabilities?: Json | null
          gold_bias?: string | null
          gold_confidence?: number | null
          hawkish_probability?: number | null
          id?: string
          inflation_pressure?: string | null
          interpretation?: string | null
          macro_theme?: string | null
          market_focus?: string | null
          narrative?: string | null
          narrative_shift?: string | null
          outcome_accurate?: boolean | null
          outcome_status?: string | null
          positioning_risk?: string | null
          predicted_outcome?: string | null
          rate_cut_probability?: number | null
          rate_hike_probability?: number | null
          recession_risk?: number | null
          smart_money_view?: string | null
          source_event_ids?: Json | null
          trade_filter?: string | null
          updated_at?: string
          usd_bias?: string | null
          usd_confidence?: number | null
          user_id?: string
        }
        Relationships: []
      }
      macro_cycles: {
        Row: {
          archived_at: string | null
          created_at: string
          current_story: Json | null
          cycle_month: string
          dominant_narrative: string | null
          forward_expectation: Json | null
          id: string
          label: string | null
          market_focus: string | null
          narrative_drivers: Json | null
          status: string
          timeline: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          current_story?: Json | null
          cycle_month: string
          dominant_narrative?: string | null
          forward_expectation?: Json | null
          id?: string
          label?: string | null
          market_focus?: string | null
          narrative_drivers?: Json | null
          status?: string
          timeline?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          current_story?: Json | null
          cycle_month?: string
          dominant_narrative?: string | null
          forward_expectation?: Json | null
          id?: string
          label?: string | null
          market_focus?: string | null
          narrative_drivers?: Json | null
          status?: string
          timeline?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      macro_events: {
        Row: {
          actual: number | null
          category: string | null
          created_at: string
          cycle_id: string | null
          event: string
          forecast: number | null
          id: string
          impact: string | null
          notes: string | null
          outcome_status: string | null
          previous: number | null
          release_date: string
          surprise: string | null
          trend: string | null
          unit: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          actual?: number | null
          category?: string | null
          created_at?: string
          cycle_id?: string | null
          event: string
          forecast?: number | null
          id?: string
          impact?: string | null
          notes?: string | null
          outcome_status?: string | null
          previous?: number | null
          release_date?: string
          surprise?: string | null
          trend?: string | null
          unit?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          actual?: number | null
          category?: string | null
          created_at?: string
          cycle_id?: string | null
          event?: string
          forecast?: number | null
          id?: string
          impact?: string | null
          notes?: string | null
          outcome_status?: string | null
          previous?: number | null
          release_date?: string
          surprise?: string | null
          trend?: string | null
          unit?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      macro_predictions: {
        Row: {
          created_at: string
          cycle_id: string | null
          fed_outlook: string | null
          gold_outlook: string | null
          id: string
          narrative: string | null
          prediction_date: string
          reviewed_at: string | null
          source_event: string
          source_event_id: string | null
          status: string
          target_event: string
          updated_at: string
          usd_outlook: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          cycle_id?: string | null
          fed_outlook?: string | null
          gold_outlook?: string | null
          id?: string
          narrative?: string | null
          prediction_date?: string
          reviewed_at?: string | null
          source_event: string
          source_event_id?: string | null
          status?: string
          target_event: string
          updated_at?: string
          usd_outlook?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          cycle_id?: string | null
          fed_outlook?: string | null
          gold_outlook?: string | null
          id?: string
          narrative?: string | null
          prediction_date?: string
          reviewed_at?: string | null
          source_event?: string
          source_event_id?: string | null
          status?: string
          target_event?: string
          updated_at?: string
          usd_outlook?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notebook_entries: {
        Row: {
          bias: string
          category: string
          created_at: string
          date: string
          entry_id: string
          id: string
          journal: Json
          legacy_image: string | null
          legacy_key_levels: string | null
          legacy_notes: string | null
          pair: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bias?: string
          category?: string
          created_at?: string
          date?: string
          entry_id: string
          id?: string
          journal?: Json
          legacy_image?: string | null
          legacy_key_levels?: string | null
          legacy_notes?: string | null
          pair?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bias?: string
          category?: string
          created_at?: string
          date?: string
          entry_id?: string
          id?: string
          journal?: Json
          legacy_image?: string | null
          legacy_key_levels?: string | null
          legacy_notes?: string | null
          pair?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      plan_audit_log: {
        Row: {
          created_at: string
          error: string | null
          id: string
          operation: string
          payload_hash: string | null
          payload_size: number | null
          plan_id: string | null
          plan_type: string
          revision: number | null
          success: boolean
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          operation: string
          payload_hash?: string | null
          payload_size?: number | null
          plan_id?: string | null
          plan_type: string
          revision?: number | null
          success: boolean
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          operation?: string
          payload_hash?: string | null
          payload_size?: number | null
          plan_id?: string | null
          plan_type?: string
          revision?: number | null
          success?: boolean
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      scale_events: {
        Row: {
          account_id: string
          created_at: string
          date: string
          id: string
          new_size: number
          note: string | null
          old_size: number
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          date: string
          id: string
          new_size?: number
          note?: string | null
          old_size?: number
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          date?: string
          id?: string
          new_size?: number
          note?: string | null
          old_size?: number
          user_id?: string
        }
        Relationships: []
      }
      trades: {
        Row: {
          accounts: Json | null
          actual_rr: number | null
          asset: string
          chart_link: string | null
          confluences: Json | null
          created_at: string
          curve: string | null
          date: string
          day_tags: Json | null
          direction: string
          entry_confluences: Json | null
          entry_price: number
          entry_time: string | null
          execution_image: string | null
          exit_price: number | null
          exit_time: string | null
          fees: number | null
          grade: string | null
          id: string
          management: Json | null
          market: string
          market_condition: string
          market_sentiment: number | null
          max_adverse_move: number | null
          max_rr_reached: number | null
          mistakes: Json | null
          notes: string | null
          order_type: string | null
          pips: number | null
          planned_rr: number
          prediction_image: string | null
          profit_loss: number
          psychology: Json | null
          quantity: number
          result: string
          session: string
          setup: string
          status: string
          stop_loss: number
          take_profit: number
          target_confluences: Json | null
          timeframe: string | null
          trade_analysis: Json | null
          trade_journey: Json | null
          trend: string | null
          user_id: string
        }
        Insert: {
          accounts?: Json | null
          actual_rr?: number | null
          asset: string
          chart_link?: string | null
          confluences?: Json | null
          created_at?: string
          curve?: string | null
          date: string
          day_tags?: Json | null
          direction: string
          entry_confluences?: Json | null
          entry_price?: number
          entry_time?: string | null
          execution_image?: string | null
          exit_price?: number | null
          exit_time?: string | null
          fees?: number | null
          grade?: string | null
          id: string
          management?: Json | null
          market: string
          market_condition: string
          market_sentiment?: number | null
          max_adverse_move?: number | null
          max_rr_reached?: number | null
          mistakes?: Json | null
          notes?: string | null
          order_type?: string | null
          pips?: number | null
          planned_rr?: number
          prediction_image?: string | null
          profit_loss?: number
          psychology?: Json | null
          quantity?: number
          result: string
          session: string
          setup: string
          status?: string
          stop_loss?: number
          take_profit?: number
          target_confluences?: Json | null
          timeframe?: string | null
          trade_analysis?: Json | null
          trade_journey?: Json | null
          trend?: string | null
          user_id: string
        }
        Update: {
          accounts?: Json | null
          actual_rr?: number | null
          asset?: string
          chart_link?: string | null
          confluences?: Json | null
          created_at?: string
          curve?: string | null
          date?: string
          day_tags?: Json | null
          direction?: string
          entry_confluences?: Json | null
          entry_price?: number
          entry_time?: string | null
          execution_image?: string | null
          exit_price?: number | null
          exit_time?: string | null
          fees?: number | null
          grade?: string | null
          id?: string
          management?: Json | null
          market?: string
          market_condition?: string
          market_sentiment?: number | null
          max_adverse_move?: number | null
          max_rr_reached?: number | null
          mistakes?: Json | null
          notes?: string | null
          order_type?: string | null
          pips?: number | null
          planned_rr?: number
          prediction_image?: string | null
          profit_loss?: number
          psychology?: Json | null
          quantity?: number
          result?: string
          session?: string
          setup?: string
          status?: string
          stop_loss?: number
          take_profit?: number
          target_confluences?: Json | null
          timeframe?: string | null
          trade_analysis?: Json | null
          trade_journey?: Json | null
          trend?: string | null
          user_id?: string
        }
        Relationships: []
      }
      trading_accounts: {
        Row: {
          broker: string
          created_at: string
          currency: string
          current_size: number
          daily_drawdown_limit: number | null
          daily_drawdown_percent: number | null
          id: string
          initial_size: number
          max_drawdown_limit: number | null
          max_drawdown_percent: number | null
          name: string
          payouts: Json | null
          phase1_target: number | null
          phase1_target_percent: number | null
          phase2_target: number | null
          phase2_target_percent: number | null
          phase3_target: number | null
          phase3_target_percent: number | null
          stage: string | null
          starting_balance: number
          status: string | null
          steps: number | null
          target_balance: number | null
          target_percent: number | null
          type: string
          user_id: string
        }
        Insert: {
          broker?: string
          created_at?: string
          currency?: string
          current_size?: number
          daily_drawdown_limit?: number | null
          daily_drawdown_percent?: number | null
          id: string
          initial_size?: number
          max_drawdown_limit?: number | null
          max_drawdown_percent?: number | null
          name: string
          payouts?: Json | null
          phase1_target?: number | null
          phase1_target_percent?: number | null
          phase2_target?: number | null
          phase2_target_percent?: number | null
          phase3_target?: number | null
          phase3_target_percent?: number | null
          stage?: string | null
          starting_balance?: number
          status?: string | null
          steps?: number | null
          target_balance?: number | null
          target_percent?: number | null
          type?: string
          user_id: string
        }
        Update: {
          broker?: string
          created_at?: string
          currency?: string
          current_size?: number
          daily_drawdown_limit?: number | null
          daily_drawdown_percent?: number | null
          id?: string
          initial_size?: number
          max_drawdown_limit?: number | null
          max_drawdown_percent?: number | null
          name?: string
          payouts?: Json | null
          phase1_target?: number | null
          phase1_target_percent?: number | null
          phase2_target?: number | null
          phase2_target_percent?: number | null
          phase3_target?: number | null
          phase3_target_percent?: number | null
          stage?: string | null
          starting_balance?: number
          status?: string | null
          steps?: number | null
          target_balance?: number | null
          target_percent?: number | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      trading_checklist_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          sections: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          sections?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          sections?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trading_checklists: {
        Row: {
          created_at: string
          date: string
          id: string
          sections: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          sections?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          sections?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          account_id: string
          amount: number
          created_at: string
          date: string
          id: string
          note: string | null
          type: string
          user_id: string
        }
        Insert: {
          account_id: string
          amount?: number
          created_at?: string
          date: string
          id: string
          note?: string | null
          type: string
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          created_at?: string
          date?: string
          id?: string
          note?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          conditions: Json | null
          created_at: string
          custom_assets: Json | null
          custom_confluences: Json | null
          custom_setups: Json | null
          grades_list: Json | null
          id: string
          management_options: Json | null
          markets: Json | null
          notebook_categories: Json | null
          preferences: Json | null
          psych_tags: Json | null
          sessions: Json | null
          updated_at: string
          user_id: string
          violations: Json | null
        }
        Insert: {
          conditions?: Json | null
          created_at?: string
          custom_assets?: Json | null
          custom_confluences?: Json | null
          custom_setups?: Json | null
          grades_list?: Json | null
          id?: string
          management_options?: Json | null
          markets?: Json | null
          notebook_categories?: Json | null
          preferences?: Json | null
          psych_tags?: Json | null
          sessions?: Json | null
          updated_at?: string
          user_id: string
          violations?: Json | null
        }
        Update: {
          conditions?: Json | null
          created_at?: string
          custom_assets?: Json | null
          custom_confluences?: Json | null
          custom_setups?: Json | null
          grades_list?: Json | null
          id?: string
          management_options?: Json | null
          markets?: Json | null
          notebook_categories?: Json | null
          preferences?: Json | null
          psych_tags?: Json | null
          sessions?: Json | null
          updated_at?: string
          user_id?: string
          violations?: Json | null
        }
        Relationships: []
      }
      weekly_plan_history: {
        Row: {
          created_at: string
          id: string
          plan_id: string
          schema_version: number | null
          snapshot: Json
          source_updated_at: string | null
          user_id: string
          version: number
        }
        Insert: {
          created_at?: string
          id?: string
          plan_id: string
          schema_version?: number | null
          snapshot: Json
          source_updated_at?: string | null
          user_id: string
          version: number
        }
        Update: {
          created_at?: string
          id?: string
          plan_id?: string
          schema_version?: number | null
          snapshot?: Json
          source_updated_at?: string | null
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      weekly_plans: {
        Row: {
          analysis_video_url: string | null
          bias: string
          calendar_result: Json | null
          created_at: string
          goals: string | null
          id: string
          levels: string | null
          markets: Json | null
          news_items: Json | null
          news_result: string | null
          observation: Json | null
          pair_analyses: Json | null
          pair_count: number
          reviewed: boolean | null
          revision: number
          risk: string | null
          setups: Json | null
          updated_at: string
          user_id: string
          week_start: string
        }
        Insert: {
          analysis_video_url?: string | null
          bias?: string
          calendar_result?: Json | null
          created_at?: string
          goals?: string | null
          id: string
          levels?: string | null
          markets?: Json | null
          news_items?: Json | null
          news_result?: string | null
          observation?: Json | null
          pair_analyses?: Json | null
          pair_count?: number
          reviewed?: boolean | null
          revision?: number
          risk?: string | null
          setups?: Json | null
          updated_at?: string
          user_id: string
          week_start: string
        }
        Update: {
          analysis_video_url?: string | null
          bias?: string
          calendar_result?: Json | null
          created_at?: string
          goals?: string | null
          id?: string
          levels?: string | null
          markets?: Json | null
          news_items?: Json | null
          news_result?: string | null
          observation?: Json | null
          pair_analyses?: Json | null
          pair_count?: number
          reviewed?: boolean | null
          revision?: number
          risk?: string | null
          setups?: Json | null
          updated_at?: string
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _safe_jsonb_array_length: { Args: { v: Json }; Returns: number }
      save_daily_plan: {
        Args: { p_expected_revision?: number; p_id: string; p_payload: Json }
        Returns: Json
      }
      save_weekly_plan: {
        Args: { p_expected_revision?: number; p_id: string; p_payload: Json }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
