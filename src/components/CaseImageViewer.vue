<template>
  <Card class="mb-4">
    <template #title>
      <div class="flex align-items-center justify-content-between">
        <span>Case #{{ caseId }} Images</span>
        <Tag v-if="images && images.length" :value="images.length + ' image' + (images.length>1?'s':'')" severity="info" />
      </div>
    </template>
    <template #content>
      <div v-if="loading" class="text-center">
        <ProgressBar mode="indeterminate" style="height: .5em" />
        <p>Loading images...</p>
      </div>
      <div v-else-if="images && images.length > 0">
        <!-- Single image: show directly without carousel/navigation -->
        <div v-if="images.length === 1" class="image-container single p-2">
          <Image :src="images[0].full_url || images[0].image_url" alt="Case Image" width="100%" preview />
        </div>
        <!-- Multiple images: fallback to carousel -->
        <Carousel v-else :value="images" :numVisible="1" :numScroll="1" circular :autoplayInterval="5000">
          <template #item="slotProps">
            <div class="image-container p-2">
              <Image :src="slotProps.data.full_url || slotProps.data.image_url" alt="Case Image" width="100%" preview />
            </div>
          </template>
        </Carousel>
      </div>
      <div v-else class="text-center">
        <p>No images available for this case.</p>
      </div>
    </template>
  </Card>
</template>

<script setup lang="ts">
import Card from 'primevue/card';
import Carousel from 'primevue/carousel';
import Image from 'primevue/image';
import ProgressBar from 'primevue/progressbar';
import Tag from 'primevue/tag';

interface ImageRead {
  id: number;
  image_url: string; // relative path
  full_url?: string; // absolute path
  case_id: number;
}

defineProps<{
  images: ImageRead[];
  loading: boolean;
  caseId?: number | null;
}>();
</script>

<style scoped>
.image-container img {
  width: 100%;
  max-height: 500px; /* Adjust as needed */
  object-fit: contain;
  border-radius: var(--border-radius);
}
.text-center {
  text-align: center;
  padding: 1rem;
}
</style>
