import { keepPreviousData, useQuery, UseQueryResult } from "@tanstack/react-query";
import {
  searchAttachments,
  searchPage,
  searchShare,
  searchSuggestions,
} from '@/features/search/services/search-service';
import {
  IAttachmentSearch,
  IPageSearch,
  IPageSearchParams,
  ISuggestionResult,
  SearchSuggestionParams,
} from '@/features/search/types/search.types';

export function usePageSearchQuery(
  params: IPageSearchParams,
): UseQueryResult<IPageSearch[], Error> {
  return useQuery({
    queryKey: ["page-search", params],
    queryFn: () => searchPage(params),
    enabled: !!params.query,
  });
}

export function useSearchSuggestionsQuery(
  params: SearchSuggestionParams & { preload?: boolean },
): UseQueryResult<ISuggestionResult, Error> {
  const { preload, ...queryParams } = params;
  return useQuery({
    // query 만 키에 넣으면 includeUsers/includePages/spaceId 가 달라도 같은 칸을
    // 쓴다 — 멤버 선택(사용자·그룹)과 링크 패널(페이지)이 같은 글자에서 서로의
    // 결과를 받는다. preload 는 queryParams 에 없으므로 캐시가 갈리지 않는다.
    queryKey: ["search-suggestion", queryParams],
    staleTime: 60 * 1000, // 1min
    queryFn: () => searchSuggestions(queryParams),
    enabled: preload || !!params.query,
    placeholderData: keepPreviousData,
  });
}

export function useShareSearchQuery(
  params: IPageSearchParams,
): UseQueryResult<IPageSearch[], Error> {
  return useQuery({
    queryKey: ["share-search", params],
    queryFn: () => searchShare(params),
    enabled: !!params.query,
  });
}

export function useAttachmentSearchQuery(
  params: IPageSearchParams,
): UseQueryResult<IAttachmentSearch[], Error> {
  return useQuery({
    queryKey: ["attachment-search", params],
    queryFn: () => searchAttachments(params),
    enabled: !!params.query,
  });
}
