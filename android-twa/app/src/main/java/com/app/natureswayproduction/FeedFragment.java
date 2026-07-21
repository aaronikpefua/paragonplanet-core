package com.app.natureswayproduction;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import java.util.Arrays;
import java.util.List;

public class FeedFragment extends Fragment {
    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.fragment_feed, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        RecyclerView categoryList = view.findViewById(R.id.category_list);
        RecyclerView videoList = view.findViewById(R.id.video_list);
        categoryList.setLayoutManager(new LinearLayoutManager(requireContext(), LinearLayoutManager.HORIZONTAL, false));
        videoList.setLayoutManager(new LinearLayoutManager(requireContext()));
        videoList.setNestedScrollingEnabled(false);

        List<String> categories = Arrays.asList("Dancers", "Singers", "Instrumentalists", "Comedians", "Debaters", "Actors", "Models", "Cultural Performers", "Special Abilities", "Stunt Performers", "Nutritionists", "Artists & Designers");
        List<VideoFeedItem> videos = Arrays.asList(
                new VideoFeedItem("g7", "Cultural Performer", "Short-video talent showcase modeled after the live home feed.", 0),
                new VideoFeedItem("Paragon Singer Spotlight", "Singers", "Native feed card placeholder ready to be connected to real Firestore video data.", 12),
                new VideoFeedItem("Comedy Corner", "Comedians", "This screen is intentionally native so we can migrate away from the Chrome/TWA wrapper.", 7),
                new VideoFeedItem("Instrumentalist Session", "Instrumentalists", "Tap into Watch to continue the autoplay experience in the web bridge while native playback is built.", 18)
        );

        categoryList.setAdapter(new CategoryAdapter(categories));
        videoList.setAdapter(new VideoFeedAdapter(videos, item -> {
            if (requireActivity() instanceof MainActivity) {
                ((MainActivity) requireActivity()).navigateToScreen(MainActivity.SCREEN_WATCH);
            }
        }));
    }
}
