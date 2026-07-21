package com.app.natureswayproduction;

public class VideoFeedItem {
    public final String title;
    public final String category;
    public final String description;
    public final int votes;

    public VideoFeedItem(String title, String category, String description, int votes) {
        this.title = title;
        this.category = category;
        this.description = description;
        this.votes = votes;
    }
}
