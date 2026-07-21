package com.app.natureswayproduction;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import java.util.List;

public class VideoFeedAdapter extends RecyclerView.Adapter<VideoFeedAdapter.VideoViewHolder> {
    public interface OnVideoClickListener { void onVideoClicked(VideoFeedItem item); }

    private final List<VideoFeedItem> items;
    private final OnVideoClickListener listener;

    public VideoFeedAdapter(List<VideoFeedItem> items, OnVideoClickListener listener) {
        this.items = items;
        this.listener = listener;
    }

    @NonNull
    @Override
    public VideoViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_video_card, parent, false);
        return new VideoViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull VideoViewHolder holder, int position) {
        VideoFeedItem item = items.get(position);
        holder.title.setText(item.title);
        holder.category.setText(item.category);
        holder.description.setText(item.description);
        holder.votes.setText("Votes: " + item.votes);
        holder.itemView.setOnClickListener(v -> listener.onVideoClicked(item));
    }

    @Override
    public int getItemCount() { return items.size(); }

    static class VideoViewHolder extends RecyclerView.ViewHolder {
        final TextView title;
        final TextView category;
        final TextView description;
        final TextView votes;
        VideoViewHolder(@NonNull View itemView) {
            super(itemView);
            title = itemView.findViewById(R.id.video_title);
            category = itemView.findViewById(R.id.video_category);
            description = itemView.findViewById(R.id.video_description);
            votes = itemView.findViewById(R.id.video_votes);
        }
    }
}
